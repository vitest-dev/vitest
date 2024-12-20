import type {
  ModuleNode,
  TransformResult,
  ViteDevServer,
  InlineConfig as ViteInlineConfig,
} from 'vite'
import type { Typechecker } from '../typecheck/typechecker'
import type { ProvidedContext } from '../types/general'
import type { OnTestsRerunHandler, Vitest } from './core'
import type { GlobalSetupFile } from './globalSetup'
import type { Logger } from './logger'
import type { ParentProjectBrowser, ProjectBrowser } from './types/browser'
import type {
  ResolvedConfig,
  SerializedConfig,
  UserConfig,
  UserWorkspaceConfig,
} from './types/config'
import { promises as fs, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deepMerge, nanoid, slash } from '@vitest/utils'
import mm from 'micromatch'
import { isAbsolute, join, relative } from 'pathe'
import { glob, type GlobOptions } from 'tinyglobby'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { setup } from '../api/setup'
import { isBrowserEnabled, resolveConfig } from './config/resolveConfig'
import { serializeConfig } from './config/serializeConfig'
import { loadGlobalSetupFiles } from './globalSetup'
import { CoverageTransform } from './plugins/coverageTransform'
import { MocksPlugins } from './plugins/mocks'
import { WorkspaceVitestPlugin } from './plugins/workspace'
import { type WorkspaceSpec as DeprecatedWorkspaceSpec, getFilePoolName } from './pool'
import { TestSpecification } from './spec'
import { createViteServer } from './vite'

export class TestProject {
  /**
   * The global Vitest instance.
   * @experimental The public Vitest API is experimental and does not follow semver.
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

  /** @deprecated use `vitest` instead */
  public ctx: Vitest

  /**
   * Temporary directory for the project. This is unique for each project. Vitest stores transformed content here.
   */
  public readonly tmpDir = join(tmpdir(), nanoid())

  /** @internal */ vitenode!: ViteNodeServer
  /** @internal */ typechecker?: Typechecker
  /** @internal */ _config?: ResolvedConfig

  private runner!: ViteNodeRunner

  private closingPromise: Promise<void> | undefined

  private testFilesList: string[] | null = null
  private typecheckFilesList: string[] | null = null

  private _globalSetups?: GlobalSetupFile[]
  private _provided: ProvidedContext = {} as any
  private _vite?: ViteDevServer

  constructor(
    /** @deprecated */
    public path: string | number,
    vitest: Vitest,
    public options?: InitializeProjectOptions,
  ) {
    this.vitest = vitest
    this.ctx = vitest
    this.globalConfig = vitest.config
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
    locations?: number[] | undefined,
    /** @internal */
    pool?: string,
  ): TestSpecification {
    return new TestSpecification(
      this,
      moduleId,
      pool || getFilePoolName(this, moduleId),
      locations,
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
   * Serialized project configuration. This is the config that tests receive.
   */
  public get serializedConfig(): SerializedConfig {
    return this._serializeOverridenConfig()
  }

  /** @deprecated use `vite` instead */
  public get server(): ViteDevServer {
    return this._vite!
  }

  /**
   * Check if this is the root project. The root project is the one that has the root config.
   */
  public isRootProject(): boolean {
    return this.vitest.getRootProject() === this
  }

  /** @deprecated use `isRootProject` instead */
  public isCore(): boolean {
    return this.isRootProject()
  }

  /** @deprecated use `createSpecification` instead */
  public createSpec(moduleId: string, pool: string): DeprecatedWorkspaceSpec {
    return new TestSpecification(this, moduleId, pool) as DeprecatedWorkspaceSpec
  }

  /** @deprecated */
  initializeGlobalSetup() {
    return this._initializeGlobalSetup()
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

  /** @deprecated */
  teardownGlobalSetup(): Promise<void> {
    return this._teardownGlobalSetup()
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

  /** @deprecated use `vitest.logger` instead */
  get logger(): Logger {
    return this.vitest.logger
  }

  // it's possible that file path was imported with different queries (?raw, ?url, etc)
  /** @deprecated use `.vite` or `.browser.vite` directly */
  getModulesByFilepath(file: string): Set<ModuleNode> {
    const set
      = this.server.moduleGraph.getModulesByFile(file)
      || this.browser?.vite.moduleGraph.getModulesByFile(file)
    return set || new Set()
  }

  /** @deprecated use `.vite` or `.browser.vite` directly */
  getModuleById(id: string): ModuleNode | undefined {
    return (
      this.server.moduleGraph.getModuleById(id)
      || this.browser?.vite.moduleGraph.getModuleById(id)
    )
  }

  /** @deprecated use `.vite` or `.browser.vite` directly */
  getSourceMapModuleById(id: string): TransformResult['map'] | undefined {
    const mod = this.server.moduleGraph.getModuleById(id)
    return mod?.ssrTransformResult?.map || mod?.transformResult?.map
  }

  /** @deprecated use `vitest.reporters` instead */
  get reporters() {
    return this.ctx.reporters
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
    const dir = this.config.dir || this.config.root

    const { include, exclude, includeSource } = this.config
    const typecheck = this.config.typecheck

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

  /**
   * Returns if the file is a test file. Requires `.globTestFiles()` to be called first.
   * @internal
   */
  isCachedTestFile(testPath: string): boolean {
    return !!this.testFilesList && this.testFilesList.includes(testPath)
  }

  /**
   * Returns if the file is a typecheck test file. Requires `.globTestFiles()` to be called first.
   * @internal
   */
  isCachedTypecheckFile(testPath: string): boolean {
    return !!this.typecheckFilesList && this.typecheckFilesList.includes(testPath)
  }

  /** @deprecated use `serializedConfig` instead */
  getSerializableConfig(): SerializedConfig {
    return this._serializeOverridenConfig()
  }

  /** @internal */
  async globFiles(include: string[], exclude: string[], cwd: string) {
    const globOptions: GlobOptions = {
      dot: true,
      cwd,
      ignore: exclude,
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
    if (this.isCachedTestFile(moduleId)) {
      return true
    }
    const relativeId = relative(this.config.dir || this.config.root, moduleId)
    if (mm.isMatch(relativeId, this.config.exclude)) {
      return false
    }
    if (mm.isMatch(relativeId, this.config.include)) {
      this.markTestFile(moduleId)
      return true
    }
    if (
      this.config.includeSource?.length
      && mm.isMatch(relativeId, this.config.includeSource)
    ) {
      const code = source?.() || readFileSync(moduleId, 'utf-8')
      if (this.isInSourceTestCode(code)) {
        this.markTestFile(moduleId)
        return true
      }
    }
    return false
  }

  /** @deprecated use `matchesTestGlob` instead */
  async isTargetFile(id: string, source?: string): Promise<boolean> {
    return this.matchesTestGlob(id, source ? () => source : undefined)
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

  /** @internal */
  _parentBrowser?: ParentProjectBrowser
  /** @internal */
  _parent?: TestProject
  /** @internal */
  _initParentBrowser = deduped(async () => {
    if (!this.isBrowserEnabled() || this._parentBrowser) {
      return
    }
    await this.vitest.packageInstaller.ensureInstalled(
      '@vitest/browser',
      this.config.root,
      this.vitest.version,
    )
    const { createBrowserServer, distRoot } = await import('@vitest/browser')
    const browser = await createBrowserServer(
      this,
      this.vite.config.configFile,
      [
        ...MocksPlugins({
          filter(id) {
            if (id.includes(distRoot)) {
              return false
            }
            return true
          },
        }),
      ],
      [CoverageTransform(this.vitest)],
    )
    this._parentBrowser = browser
    if (this.config.browser.ui) {
      setup(this.vitest, browser.vite)
    }
  })

  /** @internal */
  _initBrowserServer = deduped(async () => {
    await this._parent?._initParentBrowser()

    if (!this.browser && this._parent?._parentBrowser) {
      this.browser = this._parent._parentBrowser.spawn(this)
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
          this.browser?.close(),
          this.clearTmpDir(),
        ].filter(Boolean),
      ).then(() => {
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
    return this.runner.executeId(moduleId)
  }

  /** @deprecated use `name` instead */
  public getName(): string {
    return this.config.name || ''
  }

  /** @deprecated internal */
  public setServer(options: UserConfig, server: ViteDevServer) {
    return this._configureServer(options, server)
  }

  /** @internal */
  async _configureServer(options: UserConfig, server: ViteDevServer): Promise<void> {
    this._config = resolveConfig(
      this.vitest.mode,
      {
        ...options,
        coverage: this.vitest.config.coverage,
      },
      server.config,
      this.vitest.logger,
    )
    for (const _providedKey in this.config.provide) {
      const providedKey = _providedKey as keyof ProvidedContext
      // type is very strict here, so we cast it to any
      (this.provide as (key: string, value: unknown) => void)(
        providedKey,
        this.config.provide[providedKey],
      )
    }

    this.closingPromise = undefined

    this._vite = server

    this.vitenode = new ViteNodeServer(server, this.config.server)
    const node = this.vitenode
    this.runner = new ViteNodeRunner({
      root: server.config.root,
      base: server.config.base,
      fetchModule(id: string) {
        return node.fetchModule(id)
      },
      resolveId(id: string, importer?: string) {
        return node.resolveId(id, importer)
      },
    })
  }

  private _serializeOverridenConfig(): SerializedConfig {
    // TODO: serialize the config _once_ or when needed
    const config = serializeConfig(
      this.config,
      this.vitest.config,
      this.vite.config,
    )
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

  /** @deprecated */
  public initBrowserProvider(): Promise<void> {
    return this._initBrowserProvider()
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
      vitest.config.name || vitest.config.root,
      vitest,
    )
    project.vitenode = vitest.vitenode
    project.runner = vitest.runner
    project._vite = vitest.server
    project._config = vitest.config
    project._provideObject(vitest.config.provide)
    return project
  }

  /** @internal */
  static _cloneBrowserProject(parent: TestProject, config: ResolvedConfig): TestProject {
    const clone = new TestProject(
      parent.path,
      parent.vitest,
    )
    clone.vitenode = parent.vitenode
    clone.runner = parent.runner
    clone._vite = parent._vite
    clone._config = config
    clone._parent = parent
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

export {
  /** @deprecated use `TestProject` instead */
  TestProject as WorkspaceProject,
}

export interface SerializedTestProject {
  name: string
  serializedConfig: SerializedConfig
  context: ProvidedContext
}

interface InitializeProjectOptions extends UserWorkspaceConfig {
  configFile: string | false
  extends?: string
}

export async function initializeProject(
  workspacePath: string | number,
  ctx: Vitest,
  options: InitializeProjectOptions,
) {
  const project = new TestProject(workspacePath, ctx, options)

  const { extends: extendsConfig, configFile, ...restOptions } = options

  const config: ViteInlineConfig = {
    ...restOptions,
    configFile,
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
