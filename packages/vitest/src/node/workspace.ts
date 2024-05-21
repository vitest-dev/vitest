import { promises as fs } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import fg from 'fast-glob'
import mm from 'micromatch'
import { dirname, isAbsolute, join, relative, resolve, toNamespacedPath } from 'pathe'
import type { EnvironmentModuleNode, TransformResult } from 'vite'
import { resolveConfig } from 'vite'
import c from 'picocolors'
import type { ProvidedContext, ResolvedConfig, UserWorkspaceConfig, ViteResolvedConfig, Vitest } from '../types'
import type { Typechecker } from '../typecheck/typechecker'
import { deepMerge, nanoid } from '../utils/base'
import { isBrowserEnabled } from './config'
import { WorkspaceVitestPlugin } from './plugins/workspace'
import type { GlobalSetupFile } from './globalSetup'
import { loadGlobalSetupFiles } from './globalSetup'
import { divider } from './reporters/renderers/utils'
import { VitestDevEnvironemnt } from './environment'
import { BrowserTester } from './browser'
import { VitestServerImporter } from './importer'

interface InitializeProjectOptions extends UserWorkspaceConfig {
  workspaceConfigPath: string
  extends?: string
}

export async function initializeProject(workspacePath: string | number, ctx: Vitest, options: InitializeProjectOptions) {
  const project = new WorkspaceProject(workspacePath, ctx, options)

  const configFile = options.extends
    ? resolve(dirname(options.workspaceConfigPath), options.extends)
    : (typeof workspacePath === 'number' || workspacePath.endsWith('/'))
        ? false
        : workspacePath

  const root = options.root || (
    typeof workspacePath === 'number'
      ? undefined
      : workspacePath.endsWith('/') ? workspacePath : dirname(workspacePath)
  )

  const config = await resolveConfig({
    ...options,
    root,
    logLevel: 'error',
    configFile,
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.test?.mode || options.mode || ctx.config.mode,
    plugins: [
      ...options.plugins || [],
      WorkspaceVitestPlugin(project, { ...options, root, workspacePath }),
    ],
  }, 'serve')

  await project.resolve(config as ViteResolvedConfig)

  return project
}

export class WorkspaceProject {
  configOverride: Partial<ResolvedConfig> | undefined

  public sharedConfig!: ViteResolvedConfig
  public config!: ResolvedConfig
  public typechecker?: Typechecker
  public browser?: BrowserTester

  public closingPromise: Promise<unknown> | undefined

  testFilesList: string[] | null = null

  public readonly id = nanoid()
  public readonly tmpDir = join(tmpdir(), this.id)

  private _globalSetups: GlobalSetupFile[] | undefined
  private _provided: ProvidedContext = {} as any

  public environments: Record<string, VitestDevEnvironemnt> = {}

  private importer?: VitestServerImporter

  constructor(
    public path: string | number,
    public ctx: Vitest,
    public options?: InitializeProjectOptions,
  ) { }

  getName(): string {
    return this.config.name || ''
  }

  isCore() {
    return this.ctx.getCoreWorkspaceProject() === this
  }

  public async getImporter() {
    if (this.importer)
      return this.importer
    const importer = new VitestServerImporter(this.sharedConfig)
    await importer.init()
    await importer.environment.pluginContainer.buildStart({})
    return (this.importer = importer)
  }

  provide = <T extends keyof ProvidedContext>(key: T, value: ProvidedContext[T]) => {
    try {
      structuredClone(value)
    }
    catch (err) {
      throw new Error(`Cannot provide "${key}" because it's not serializable.`, {
        cause: err,
      })
    }
    (this._provided as any)[key] = value
  }

  getProvidedContext(): ProvidedContext {
    if (this.isCore())
      return this._provided
    // globalSetup can run even if core workspace is not part of the test run
    // so we need to inherit its provided context
    return {
      ...this.ctx.getCoreWorkspaceProject().getProvidedContext(),
      ...this._provided,
    }
  }

  async initializeGlobalSetup() {
    if (this._globalSetups)
      return

    const importer = await this.getImporter()

    this._globalSetups = await loadGlobalSetupFiles(importer, this.config.globalSetup)

    try {
      for (const globalSetupFile of this._globalSetups) {
        const teardown = await globalSetupFile.setup?.({ provide: this.provide, config: this.config })
        if (teardown == null || !!globalSetupFile.teardown)
          continue
        if (typeof teardown !== 'function')
          throw new Error(`invalid return value in globalSetup file ${globalSetupFile.file}. Must return a function`)
        globalSetupFile.teardown = teardown
      }
    }
    catch (e) {
      this.logger.error(`\n${c.red(divider(c.bold(c.inverse(' Error during global setup '))))}`)
      this.logger.printError(e)
      process.exit(1)
    }
  }

  async teardownGlobalSetup() {
    if (!this._globalSetups)
      return
    for (const globalSetupFile of [...this._globalSetups].reverse()) {
      try {
        await globalSetupFile.teardown?.()
      }
      catch (error) {
        this.logger.error(`error during global teardown of ${globalSetupFile.file}`, error)
        this.logger.printError(error)
        process.exitCode = 1
      }
    }
  }

  get logger() {
    return this.ctx.logger
  }

  isFileProcessed(file: string) {
    const browser = this.browser?.server.environments.client
    if (browser?.moduleGraph.getModuleById(file))
      return true

    for (const name in this.environments) {
      const environment = this.environments[name]
      if (environment.moduleGraph.getModuleById(file))
        return true
    }

    return false
  }

  getModulesByFilepath(file: string) {
    const nodes: Set<EnvironmentModuleNode> = new Set()
    for (const name in this.environments) {
      const environment = this.environments[name]
      const modules = environment.moduleGraph.getModulesByFile(file)
      modules?.forEach(mod => nodes.add(mod))
    }
    const browser = this.browser?.server.environments.client
    const browserModules = browser?.moduleGraph.getModulesByFile(file)
    browserModules?.forEach(mod => nodes.add(mod))
    return nodes
  }

  getBrowserSourceMapModuleById(id: string): TransformResult['map'] | undefined {
    const browser = this.browser?.server.environments.client
    return browser?.moduleGraph?.getModuleById(id)?.transformResult?.map
  }

  get reporters() {
    return this.ctx.reporters
  }

  async globTestFiles(filters: string[] = []) {
    const dir = this.config.dir || this.config.root

    const { include, exclude, includeSource } = this.config
    const typecheck = this.config.typecheck

    const [testFiles, typecheckTestFiles] = await Promise.all([
      typecheck.enabled && typecheck.only ? [] : this.globAllTestFiles(include, exclude, includeSource, dir),
      typecheck.enabled ? this.globFiles(typecheck.include, typecheck.exclude, dir) : [],
    ])

    return this.filterFiles([...testFiles, ...typecheckTestFiles], filters, dir)
  }

  async globAllTestFiles(include: string[], exclude: string[], includeSource: string[] | undefined, cwd: string) {
    if (this.testFilesList)
      return this.testFilesList

    const testFiles = await this.globFiles(include, exclude, cwd)

    if (includeSource?.length) {
      const files = await this.globFiles(includeSource, exclude, cwd)

      await Promise.all(files.map(async (file) => {
        try {
          const code = await fs.readFile(file, 'utf-8')
          if (this.isInSourceTestFile(code))
            testFiles.push(file)
        }
        catch {
          return null
        }
      }))
    }

    this.testFilesList = testFiles

    return testFiles
  }

  isTestFile(id: string) {
    return this.testFilesList && this.testFilesList.includes(id)
  }

  async globFiles(include: string[], exclude: string[], cwd: string) {
    const globOptions: fg.Options = {
      dot: true,
      cwd,
      ignore: exclude,
    }

    const files = await fg(include, globOptions)
    return files.map(file => resolve(cwd, file))
  }

  async isTargetFile(id: string, source?: string): Promise<boolean> {
    const relativeId = relative(this.config.dir || this.config.root, id)
    if (mm.isMatch(relativeId, this.config.exclude))
      return false
    if (mm.isMatch(relativeId, this.config.include))
      return true
    if (this.config.includeSource?.length && mm.isMatch(relativeId, this.config.includeSource)) {
      source = source || await fs.readFile(id, 'utf-8')
      return this.isInSourceTestFile(source)
    }
    return false
  }

  isInSourceTestFile(code: string) {
    return code.includes('import.meta.vitest')
  }

  filterFiles(testFiles: string[], filters: string[], dir: string) {
    if (filters.length && process.platform === 'win32')
      filters = filters.map(f => toNamespacedPath(f))

    if (filters.length) {
      return testFiles.filter((t) => {
        const testFile = relative(dir, t).toLocaleLowerCase()
        return filters.some((f) => {
          // if filter is a full file path, we should include it if it's in the same folder
          if (isAbsolute(f) && t.startsWith(f))
            return true

          const relativePath = f.endsWith('/') ? join(relative(dir, f), '/') : relative(dir, f)
          return testFile.includes(f.toLocaleLowerCase()) || testFile.includes(relativePath.toLocaleLowerCase())
        })
      })
    }

    return testFiles
  }

  async initBrowserServer() {
    if (!this.isBrowserEnabled())
      return
    await this.browser?.close()
    this.browser = new BrowserTester()
    await this.browser.startServer(this)
  }

  static createBasicProject(ctx: Vitest) {
    const project = new WorkspaceProject(ctx.config.name || ctx.config.root, ctx)
    project.config = ctx.config
    return project
  }

  static async createCoreProject(ctx: Vitest) {
    const project = WorkspaceProject.createBasicProject(ctx)
    await project.initBrowserServer()
    return project
  }

  async resolve(
    sharedConfig: ViteResolvedConfig,
  ) {
    this.sharedConfig = sharedConfig
    this.config = sharedConfig.test

    await this.initBrowserServer()
  }

  isBrowserEnabled() {
    return isBrowserEnabled(this.config)
  }

  getSerializableConfig() {
    const optimizer = this.config.deps?.optimizer
    const poolOptions = this.config.poolOptions

    // Resolve from server.config to avoid comparing against default value
    // @ts-expect-error accessing private option
    const isolate = this.sharedConfig?._test?.isolate

    return deepMerge({
      ...this.config,

      poolOptions: {
        forks: {
          singleFork: poolOptions?.forks?.singleFork ?? this.ctx.config.poolOptions?.forks?.singleFork ?? false,
          isolate: poolOptions?.forks?.isolate ?? isolate ?? this.ctx.config.poolOptions?.forks?.isolate ?? true,
        },
        threads: {
          singleThread: poolOptions?.threads?.singleThread ?? this.ctx.config.poolOptions?.threads?.singleThread ?? false,
          isolate: poolOptions?.threads?.isolate ?? isolate ?? this.ctx.config.poolOptions?.threads?.isolate ?? true,
        },
        vmThreads: {
          singleThread: poolOptions?.vmThreads?.singleThread ?? this.ctx.config.poolOptions?.vmThreads?.singleThread ?? false,
        },
      },

      reporters: [],
      deps: {
        ...this.config.deps,
        optimizer: {
          web: {
            enabled: optimizer?.web?.enabled ?? true,
          },
          ssr: {
            enabled: optimizer?.ssr?.enabled ?? true,
          },
        },
      },
      snapshotOptions: {
        ...this.ctx.config.snapshotOptions,
        expand: this.config.snapshotOptions.expand ?? this.ctx.config.snapshotOptions.expand,
        resolveSnapshotPath: undefined,
      },
      onConsoleLog: undefined!,
      onStackTrace: undefined!,
      sequence: {
        ...this.ctx.config.sequence,
        sequencer: undefined!,
      },
      benchmark: {
        ...this.config.benchmark,
        reporters: [],
      },
      inspect: this.ctx.config.inspect,
      inspectBrk: this.ctx.config.inspectBrk,
      inspector: this.ctx.config.inspector,
      alias: [],
      includeTaskLocation: this.config.includeTaskLocation ?? this.ctx.config.includeTaskLocation,
      env: {
        ...this.sharedConfig.env,
        ...this.config.env,
      },
      browser: {
        ...this.ctx.config.browser,
        commands: {},
      },
    }, this.ctx.configOverride || {} as any) as ResolvedConfig
  }

  close() {
    if (!this.closingPromise) {
      this.closingPromise = Promise.all([
        ...Object.values(this.environments).map(e => e.close()),
        this.importer?.close(),
        this.typechecker?.stop(),
        this.browser?.close(),
        this.clearTmpDir(),
      ].filter(Boolean)).then(() => this._provided = {} as any)
    }
    return this.closingPromise
  }

  private async clearTmpDir() {
    try {
      await rm(this.tmpDir, { force: true, recursive: true })
    }
    catch {}
  }

  async initBrowserProvider() {
    if (!this.isBrowserEnabled())
      return
    await this.browser?.initialize(this)
  }

  async ensureEnvironment(name: string): Promise<VitestDevEnvironemnt> {
    if (this.environments[name])
      return this.environments[name]
    const environment = new VitestDevEnvironemnt(name, this.sharedConfig)
    this.environments[name] = environment
    await environment.init()
    // TODO: remove when bug is fixed
    this.sharedConfig.environments[name] = environment.options
    await environment.pluginContainer.buildStart({})
    return environment
  }
}
