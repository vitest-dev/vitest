import type { GlobOptions } from 'tinyglobby'
import type { DevEnvironment, ViteDevServer, InlineConfig as ViteInlineConfig } from 'vite'
import type { ModuleRunner } from 'vite/module-runner'
import type { Typechecker } from '../typecheck/typechecker'
import type { ProvidedContext } from '../types/general'
import type { OnTestsRerunHandler, Vitest } from './core'
import type { VitestFetchFunction } from './environments/fetchModule'
import type { GlobalSetupFile } from './globalSetup'
import type { TestSpecificationOptions } from './test-specification'
import type { ParentProjectBrowser, ProjectBrowser } from './types/browser'
import type {
  ProjectName,
  ResolvedConfig,
  SerializedConfig,
  TestProjectInlineConfiguration,
  UserConfig,
} from './types/config'
import { promises as fs, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deepMerge, nanoid, slash } from '@vitest/utils/helpers'
import { isAbsolute, join, relative } from 'pathe'
import pm from 'picomatch'
import { glob } from 'tinyglobby'
import { isRunnableDevEnvironment } from 'vite'
import { setup } from '../api/setup'
import { createDefinesScript } from '../utils/config-helpers'
import { NativeModuleRunner } from '../utils/nativeModuleRunner'
import { isBrowserEnabled, resolveConfig } from './config/resolveConfig'
import { serializeConfig } from './config/serializeConfig'
import { createFetchModuleFunction } from './environments/fetchModule'
import { ServerModuleRunner } from './environments/serverRunner'
import { loadGlobalSetupFiles } from './globalSetup'
import { CoverageTransform } from './plugins/coverageTransform'
import { MetaEnvReplacerPlugin } from './plugins/metaEnvReplacer'
import { MocksPlugins } from './plugins/mocks'
import { WorkspaceVitestPlugin } from './plugins/workspace'
import { getFilePoolName } from './pool'
import { VitestResolver } from './resolver'
import { TestSpecification } from './test-specification'
import { createViteServer } from './vite'

export class TestProject {
  /**
   * The global Vitest instance.
   */
  public readonly vitest: Vitest

  /**
   * Resolved global configuration. If there are no workspace projects, this will be the same as `config`.
   */
  public readonly globalConfig: ResolvedConfig

  /**
   * Browser instance if the browser is enabled. This is initialized when the tests run for the first time.
   */
  public browser?: ProjectBrowser

  /**
   * Temporary directory for the project. This is unique for each project. Vitest stores transformed content here.
   */
  public readonly tmpDir: string

  /** @internal */ typechecker?: Typechecker
  /** @internal */ _config?: ResolvedConfig
  /** @internal */ _vite?: ViteDevServer
  /** @internal */ _hash?: string
  /** @internal */ _resolver!: VitestResolver
  /** @internal */ _fetcher!: VitestFetchFunction
  /** @internal */ _serializedDefines?: string
  /** @inetrnal */ testFilesList: string[] | null = null

  private runner!: ModuleRunner

  private closingPromise: Promise<void> | undefined

  private typecheckFilesList: string[] | null = null

  private _globalSetups?: GlobalSetupFile[]
  private _provided: ProvidedContext = {} as any

  constructor(
    vitest: Vitest,
    public options?: InitializeProjectOptions | undefined,
    tmpDir?: string,
  ) {
    this.vitest = vitest
    this.globalConfig = vitest.config
    this.tmpDir = tmpDir || join(tmpdir(), nanoid())
  }

  /**
   * The unique hash of this project. This value is consistent between the reruns.
   *
   * It is based on the root of the project (not consistent between OS) and its name.
   */
  public get hash(): string {
    if (!this._hash) {
      throw new Error('The server was not set. It means that `project.hash` was called before the Vite server was established.')
    }
    return this._hash
  }

  // "provide" is a property, not a method to keep the context when destructed in the global setup,
  // making it a method would be a breaking change, and can be done in Vitest 3 at minimum
  /**
   * Provide a value to the test context. This value will be available to all tests with `inject`.
   */
  provide = <T extends keyof ProvidedContext & string>(
    key: T,
    value: ProvidedContext[T],
  ): void => {
    try {
      structuredClone(value)
    }
    catch (err) {
      throw new Error(
        `Cannot provide "${key}" because it's not serializable.`,
        {
          cause: err,
        },
      )
    }
    // casting `any` because the default type is `never` since `ProvidedContext` is empty
    (this._provided as any)[key] = value
  }

  /**
   * Get the provided context. The project context is merged with the global context.
   */
  getProvidedContext(): ProvidedContext {
    if (this.isRootProject()) {
      return this._provided
    }
    // globalSetup can run even if core workspace is not part of the test run
    // so we need to inherit its provided context
    return {
      ...this.vitest.getRootProject().getProvidedContext(),
      ...this._provided,
    }
  }

  /**
   * Creates a new test specification. Specifications describe how to run tests.
   * @param moduleId The file path
   */
  public createSpecification(
    moduleId: string,
    locationsOrOptions?: number[] | TestSpecificationOptions | undefined,
    /** @internal */
    pool?: string,
  ): TestSpecification {
    return new TestSpecification(
      this,
      moduleId,
      pool || getFilePoolName(this),
      locationsOrOptions,
    )
  }

  public toJSON(): SerializedTestProject {
    return {
      name: this.name,
      serializedConfig: this.serializedConfig,
      context: this.getProvidedContext(),
    }
  }

  /**
   * Vite's dev server instance. Every workspace project has its own server.
   */
  public get vite(): ViteDevServer {
    if (!this._vite) {
      throw new Error('The server was not set. It means that `project.vite` was called before the Vite server was established.')
    }
    // checking it once should be enough
    Object.defineProperty(this, 'vite', {
      configurable: true,
      writable: true,
      value: this._vite,
    })
    return this._vite
  }

  /**
   * Resolved project configuration.
   */
  public get config(): ResolvedConfig {
    if (!this._config) {
      throw new Error('The config was not set. It means that `project.config` was called before the Vite server was established.')
    }
    // checking it once should be enough
    // Object.defineProperty(this, 'config', {
    //   configurable: true,
    //   writable: true,
    //   value: this._config,
    // })
    return this._config
  }

  /**
   * The name of the project or an empty string if not set.
   */
  public get name(): string {
    return this.config.name || ''
  }

  /**
   * The color used when reporting tasks of this project.
   */
  public get color(): ProjectName['color'] {
    return this.config.color
  }

  /**
   * Serialized project configuration. This is the config that tests receive.
   */
  public get serializedConfig(): SerializedConfig {
    return this._serializeOverriddenConfig()
  }

  /**
   * Check if this is the root project. The root project is the one that has the root config.
   */
  public isRootProject(): boolean {
    return this.vitest.getRootProject() === this
  }

  /** @internal */
  async _initializeGlobalSetup() {
    if (this._globalSetups) {
      return
    }

    this._globalSetups = await loadGlobalSetupFiles(
      this.runner,
      this.config.globalSetup,
    )

    for (const globalSetupFile of this._globalSetups) {
      const teardown = await globalSetupFile.setup?.(this)
      if (teardown == null || !!globalSetupFile.teardown) {
        continue
      }
      if (typeof teardown !== 'function') {
        throw new TypeError(
          `invalid return value in globalSetup file ${globalSetupFile.file}. Must return a function`,
        )
      }
      globalSetupFile.teardown = teardown
    }
  }

  onTestsRerun(cb: OnTestsRerunHandler): void {
    this.vitest.onTestsRerun(cb)
  }

  /** @internal */
  async _teardownGlobalSetup(): Promise<void> {
    if (!this._globalSetups) {
      return
    }
    for (const globalSetupFile of [...this._globalSetups].reverse()) {
      await globalSetupFile.teardown?.()
    }
  }

  /**
   * Get all files in the project that match the globs in the config and the filters.
   * @param filters String filters to match the test files.
   */
  async globTestFiles(filters: string[] = []): Promise<{
    /**
     * Test files that match the filters.
     */
    testFiles: string[]
    /**
     * Typecheck test files that match the filters. This will be empty unless `typecheck.enabled` is `true`.
     */
    typecheckTestFiles: string[]
  }> {
    return this.vitest._traces.$('vitest.config.resolve_include_project', async (span) => {
      const dir = this.config.dir || this.config.root

      const { include, exclude, includeSource } = this.config
      const typecheck = this.config.typecheck
      span.setAttributes({
        cwd: dir,
        include,
        exclude,
        includeSource,
        typecheck: typecheck.enabled ? typecheck.include : [],
      })

      const [testFiles, typecheckTestFiles] = await Promise.all([
        typecheck.enabled && typecheck.only
          ? []
          : this.globAllTestFiles(include, exclude, includeSource, dir),
        typecheck.enabled
          ? (this.typecheckFilesList || this.globFiles(typecheck.include, typecheck.exclude, dir))
          : [],
      ])

      this.typecheckFilesList = typecheckTestFiles

      return {
        testFiles: this.filterFiles(
          testFiles,
          filters,
          dir,
        ),
        typecheckTestFiles: this.filterFiles(
          typecheckTestFiles,
          filters,
          dir,
        ),
      }
    })
  }

  private async globAllTestFiles(
    include: string[],
    exclude: string[],
    includeSource: string[] | undefined,
    cwd: string,
  ): Promise<string[]> {
    if (this.testFilesList) {
      return this.testFilesList
    }

    const testFiles = await this.globFiles(include, exclude, cwd)

    if (includeSource?.length) {
      const files = await this.globFiles(includeSource, exclude, cwd)

      await Promise.all(
        files.map(async (file) => {
          try {
            const code = await fs.readFile(file, 'utf-8')
            if (this.isInSourceTestCode(code)) {
              testFiles.push(file)
            }
          }
          catch {
            return null
          }
        }),
      )
    }

    this.testFilesList = testFiles

    return testFiles
  }

  isBrowserEnabled(): boolean {
    return isBrowserEnabled(this.config)
  }

  private markTestFile(testPath: string): void {
    this.testFilesList?.push(testPath)
  }

  /** @internal */
  _removeCachedTestFile(testPath: string): void {
    if (this.testFilesList) {
      this.testFilesList = this.testFilesList.filter(file => file !== testPath)
    }
  }

  /**
   * Returns if the file is a test file. Requires `.globTestFiles()` to be called first.
   * @internal
   */
  _isCachedTestFile(testPath: string): boolean {
    return !!this.testFilesList && this.testFilesList.includes(testPath)
  }

  /**
   * Returns if the file is a typecheck test file. Requires `.globTestFiles()` to be called first.
   * @internal
   */
  _isCachedTypecheckFile(testPath: string): boolean {
    return !!this.typecheckFilesList && this.typecheckFilesList.includes(testPath)
  }

  /** @internal */
  async globFiles(include: string[], exclude: string[], cwd: string) {
    const globOptions: GlobOptions = {
      dot: true,
      cwd,
      ignore: exclude,
      expandDirectories: false,
    }

    const files = await glob(include, globOptions)
    // keep the slashes consistent with Vite
    // we are not using the pathe here because it normalizes the drive letter on Windows
    // and we want to keep it the same as working dir
    return files.map(file => slash(path.resolve(cwd, file)))
  }

  /**
   * Test if a file matches the test globs. This does the actual glob matching if the test is not cached, unlike `isCachedTestFile`.
   */
  public matchesTestGlob(moduleId: string, source?: () => string): boolean {
    if (this._isCachedTestFile(moduleId)) {
      return true
    }
    const relativeId = relative(this.config.dir || this.config.root, moduleId)
    if (pm.isMatch(relativeId, this.config.exclude)) {
      return false
    }
    if (pm.isMatch(relativeId, this.config.include)) {
      this.markTestFile(moduleId)
      return true
    }
    if (
      this.config.includeSource?.length
      && pm.isMatch(relativeId, this.config.includeSource)
    ) {
      const code = source?.() || readFileSync(moduleId, 'utf-8')
      if (this.isInSourceTestCode(code)) {
        this.markTestFile(moduleId)
        return true
      }
    }
    return false
  }

  private isInSourceTestCode(code: string): boolean {
    return code.includes('import.meta.vitest')
  }

  private filterFiles(testFiles: string[], filters: string[], dir: string): string[] {
    if (filters.length && process.platform === 'win32') {
      filters = filters.map(f => slash(f))
    }

    if (filters.length) {
      return testFiles.filter((t) => {
        const testFile = relative(dir, t).toLocaleLowerCase()
        return filters.some((f) => {
          // if filter is a full file path, we should include it if it's in the same folder
          if (isAbsolute(f) && t.startsWith(f)) {
            return true
          }

          const relativePath = f.endsWith('/')
            ? join(relative(dir, f), '/')
            : relative(dir, f)
          return (
            testFile.includes(f.toLocaleLowerCase())
            || testFile.includes(relativePath.toLocaleLowerCase())
          )
        })
      })
    }

    return testFiles
  }

  private _parentBrowser?: ParentProjectBrowser
  /** @internal */
  public _parent?: TestProject
  /** @internal */
  _initParentBrowser = deduped(async (childProject: TestProject) => {
    if (!this.isBrowserEnabled() || this._parentBrowser) {
      return
    }
    const provider = this.config.browser.provider || childProject.config.browser.provider
    if (provider == null) {
      throw new Error(`Provider was not specified in the "browser.provider" setting. Please, pass down playwright(), webdriverio() or preview() from "@vitest/browser-playwright", "@vitest/browser-webdriverio" or "@vitest/browser-preview" package respectively.`)
    }
    if (typeof provider.serverFactory !== 'function') {
      throw new TypeError(`The browser provider options do not return a "serverFactory" function. Are you using the latest "@vitest/browser-${provider.name}" package?`)
    }
    const browser = await provider.serverFactory({
      project: this,
      mocksPlugins: options => MocksPlugins(options),
      metaEnvReplacer: () => MetaEnvReplacerPlugin(),
      coveragePlugin: () => CoverageTransform(this.vitest),
    })
    this._parentBrowser = browser
    if (this.config.browser.ui) {
      setup(this.vitest, browser.vite)
    }
  })

  /** @internal */
  _initBrowserServer = deduped(async () => {
    await this._parent?._initParentBrowser(this)

    if (!this.browser && this._parent?._parentBrowser) {
      this.browser = this._parent._parentBrowser.spawn(this)
      await this.vitest.report('onBrowserInit', this)
    }
  })

  /**
   * Closes the project and all associated resources. This can only be called once; the closing promise is cached until the server restarts.
   * If the resources are needed again, create a new project.
   */
  public close(): Promise<void> {
    if (!this.closingPromise) {
      this.closingPromise = Promise.all(
        [
          this.vite?.close(),
          this.typechecker?.stop(),
          // browser might not be set if it threw an error during initialization
          (this.browser || this._parent?._parentBrowser?.vite)?.close(),
          this.clearTmpDir(),
        ].filter(Boolean),
      ).then(() => {
        if (!this.runner.isClosed()) {
          return this.runner.close()
        }
      }).then(() => {
        this._provided = {} as any
        this._vite = undefined
      })
    }
    return this.closingPromise
  }

  /**
   * Import a file using Vite module runner.
   * @param moduleId The ID of the module in Vite module graph
   */
  public import<T>(moduleId: string): Promise<T> {
    return this.runner.import(moduleId)
  }

  private _setHash() {
    this._hash = generateHash(
      this._config!.root + this._config!.name,
    )
  }

  /** @internal */
  async _configureServer(options: UserConfig, server: ViteDevServer): Promise<void> {
    this._config = resolveConfig(
      this.vitest,
      {
        ...options,
        coverage: this.vitest.config.coverage,
      },
      server.config,
    )
    this._config.api.token = this.vitest.config.api.token
    this._setHash()
    for (const _providedKey in this.config.provide) {
      const providedKey = _providedKey as keyof ProvidedContext
      // type is very strict here, so we cast it to any
      (this.provide as (key: string, value: unknown) => void)(
        providedKey,
        this.config.provide[providedKey],
      )
    }

    this.closingPromise = undefined

    this._resolver = new VitestResolver(server.config.cacheDir, this._config)
    this._vite = server
    this._serializedDefines = createDefinesScript(server.config.define)
    this._fetcher = createFetchModuleFunction(
      this._resolver,
      this._config,
      this.vitest._fsCache,
      this.vitest._traces,
      this.tmpDir,
    )

    const environment = server.environments.__vitest__
    this.runner = this._config.experimental.viteModuleRunner === false
      ? new NativeModuleRunner(this._config.root)
      : new ServerModuleRunner(
          environment,
          this._fetcher,
          this._config,
        )

    const ssrEnvironment = server.environments.ssr
    if (isRunnableDevEnvironment(ssrEnvironment)) {
      const ssrRunner = new ServerModuleRunner(
        ssrEnvironment,
        this._fetcher,
        this._config,
      )
      Object.defineProperty(ssrEnvironment, 'runner', {
        value: ssrRunner,
        writable: true,
        configurable: true,
      })
    }
  }

  /** @internal */
  public _getViteEnvironments(): DevEnvironment[] {
    return [
      ...Object.values(this.browser?.vite.environments || {}),
      ...Object.values(this.vite.environments || {}),
    ]
  }

  private _serializeOverriddenConfig(): SerializedConfig {
    // TODO: serialize the config _once_ or when needed
    const config = serializeConfig(this)
    if (!this.vitest.configOverride) {
      return config
    }
    return deepMerge(
      config,
      this.vitest.configOverride,
    )
  }

  private async clearTmpDir(): Promise<void> {
    try {
      await rm(this.tmpDir, { recursive: true })
    }
    catch {}
  }

  /** @internal */
  _initBrowserProvider = deduped(async (): Promise<void> => {
    if (!this.isBrowserEnabled() || this.browser?.provider) {
      return
    }
    if (!this.browser) {
      await this._initBrowserServer()
    }
    await this.browser?.initBrowserProvider(this)
  })

  /** @internal */
  public _provideObject(context: Partial<ProvidedContext>): void {
    for (const _providedKey in context) {
      const providedKey = _providedKey as keyof ProvidedContext
      // type is very strict here, so we cast it to any
      (this.provide as (key: string, value: unknown) => void)(
        providedKey,
        context[providedKey],
      )
    }
  }

  /** @internal */
  static _createBasicProject(vitest: Vitest): TestProject {
    const project = new TestProject(
      vitest,
      undefined,
      vitest._tmpDir,
    )
    project.runner = vitest.runner
    project._vite = vitest.vite
    project._config = vitest.config
    project._resolver = vitest._resolver
    project._fetcher = vitest._fetcher
    project._serializedDefines = createDefinesScript(vitest.vite.config.define)
    project._setHash()
    project._provideObject(vitest.config.provide)
    return project
  }

  /** @internal */
  static _cloneBrowserProject(parent: TestProject, config: ResolvedConfig): TestProject {
    const clone = new TestProject(parent.vitest, undefined, parent.tmpDir)
    clone.runner = parent.runner
    clone._vite = parent._vite
    clone._resolver = parent._resolver
    clone._fetcher = parent._fetcher
    clone._config = config
    clone._setHash()
    clone._parent = parent
    clone._serializedDefines = parent._serializedDefines
    clone._provideObject(config.provide)
    return clone
  }
}

function deduped<T extends (...args: any[]) => Promise<void>>(cb: T): T {
  let _promise: Promise<void> | undefined
  return ((...args: any[]) => {
    if (!_promise) {
      _promise = cb(...args).finally(() => {
        _promise = undefined
      })
    }
    return _promise
  }) as T
}

export interface SerializedTestProject {
  name: string
  serializedConfig: SerializedConfig
  context: ProvidedContext
}

interface InitializeProjectOptions extends TestProjectInlineConfiguration {
  configFile: string | false
}

export async function initializeProject(
  workspacePath: string | number,
  ctx: Vitest,
  options: InitializeProjectOptions,
): Promise<TestProject> {
  const project = new TestProject(ctx, options)

  const { configFile, ...restOptions } = options

  const config: ViteInlineConfig = {
    ...restOptions,
    configFile,
    configLoader: ctx.vite.config.inlineConfig.configLoader,
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.test?.mode || options.mode || ctx.config.mode,
    plugins: [
      ...(options.plugins || []),
      WorkspaceVitestPlugin(project, { ...options, workspacePath }),
    ],
  }

  await createViteServer(config)

  return project
}

function generateHash(str: string): string {
  let hash = 0
  if (str.length === 0) {
    return `${hash}`
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `${hash}`
}
