import { promises as fs } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import fg from 'fast-glob'
import mm from 'micromatch'
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  toNamespacedPath,
} from 'pathe'
import type {
  TransformResult,
  ViteDevServer,
  InlineConfig as ViteInlineConfig,
} from 'vite'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { createBrowserServer } from '../integrations/browser/server'
import type {
  ProvidedContext,
  ResolvedConfig,
  UserConfig,
  UserWorkspaceConfig,
  Vitest,
} from '../types'
import type { Typechecker } from '../typecheck/typechecker'
import type { BrowserProvider } from '../types/browser'
import { getBrowserProvider } from '../integrations/browser'
import { deepMerge, nanoid } from '../utils/base'
import { VitestBrowserServerMocker } from '../integrations/browser/mocker'
import type { WebSocketBrowserRPC } from '../api/types'
import { isBrowserEnabled, resolveConfig } from './config'
import { WorkspaceVitestPlugin } from './plugins/workspace'
import { createViteServer } from './vite'
import type { GlobalSetupFile } from './globalSetup'
import { loadGlobalSetupFiles } from './globalSetup'

interface InitializeProjectOptions extends UserWorkspaceConfig {
  workspaceConfigPath: string
  extends?: string
}

export async function initializeProject(
  workspacePath: string | number,
  ctx: Vitest,
  options: InitializeProjectOptions,
) {
  const project = new WorkspaceProject(workspacePath, ctx, options)

  const configFile = options.extends
    ? resolve(dirname(options.workspaceConfigPath), options.extends)
    : typeof workspacePath === 'number' || workspacePath.endsWith('/')
      ? false
      : workspacePath

  const root
    = options.root
    || (typeof workspacePath === 'number'
      ? undefined
      : workspacePath.endsWith('/')
        ? workspacePath
        : dirname(workspacePath))

  const config: ViteInlineConfig = {
    ...options,
    root,
    logLevel: 'error',
    configFile,
    // this will make "mode": "test" | "benchmark" inside defineConfig
    mode: options.test?.mode || options.mode || ctx.config.mode,
    plugins: [
      ...(options.plugins || []),
      WorkspaceVitestPlugin(project, { ...options, root, workspacePath }),
    ],
  }

  await createViteServer(config)

  return project
}

export class WorkspaceProject {
  configOverride: Partial<ResolvedConfig> | undefined

  config!: ResolvedConfig
  server!: ViteDevServer
  vitenode!: ViteNodeServer
  runner!: ViteNodeRunner
  browser?: ViteDevServer
  typechecker?: Typechecker

  closingPromise: Promise<unknown> | undefined

  // TODO: abstract browser related things and move to @vitest/browser
  browserProvider: BrowserProvider | undefined
  browserMocker = new VitestBrowserServerMocker(this)
  // TODO: I mean, we really need to abstract it
  browserRpc = {
    orchestrators: new Map<string, WebSocketBrowserRPC>(),
    testers: new Map<string, WebSocketBrowserRPC>(),
  }

  browserState = new Map<
    string,
    {
      files: string[]
      resolve: () => void
      reject: (v: unknown) => void
    }
  >()

  testFilesList: string[] | null = null

  public readonly id = nanoid()
  public readonly tmpDir = join(tmpdir(), this.id)

  private _globalSetups: GlobalSetupFile[] | undefined
  private _provided: ProvidedContext = {} as any

  constructor(
    public path: string | number,
    public ctx: Vitest,
    public options?: InitializeProjectOptions,
  ) {}

  getName(): string {
    return this.config.name || ''
  }

  isCore() {
    return this.ctx.getCoreWorkspaceProject() === this
  }

  provide = <T extends keyof ProvidedContext>(
    key: T,
    value: ProvidedContext[T],
  ) => {
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
    (this._provided as any)[key] = value
  }

  getProvidedContext(): ProvidedContext {
    if (this.isCore()) {
      return this._provided
    }
    // globalSetup can run even if core workspace is not part of the test run
    // so we need to inherit its provided context
    return {
      ...this.ctx.getCoreWorkspaceProject().getProvidedContext(),
      ...this._provided,
    }
  }

  async initializeGlobalSetup() {
    if (this._globalSetups) {
      return
    }

    this._globalSetups = await loadGlobalSetupFiles(
      this.runner,
      this.config.globalSetup,
    )

    for (const globalSetupFile of this._globalSetups) {
      const teardown = await globalSetupFile.setup?.({
        provide: this.provide,
        config: this.config,
      })
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

  async teardownGlobalSetup() {
    if (!this._globalSetups) {
      return
    }
    for (const globalSetupFile of [...this._globalSetups].reverse()) {
      await globalSetupFile.teardown?.()
    }
  }

  get logger() {
    return this.ctx.logger
  }

  // it's possible that file path was imported with different queries (?raw, ?url, etc)
  getModulesByFilepath(file: string) {
    const set
      = this.server.moduleGraph.getModulesByFile(file)
      || this.browser?.moduleGraph.getModulesByFile(file)
    return set || new Set()
  }

  getModuleById(id: string) {
    return (
      this.server.moduleGraph.getModuleById(id)
      || this.browser?.moduleGraph.getModuleById(id)
    )
  }

  getSourceMapModuleById(id: string): TransformResult['map'] | undefined {
    const mod = this.server.moduleGraph.getModuleById(id)
    return mod?.ssrTransformResult?.map || mod?.transformResult?.map
  }

  getBrowserSourceMapModuleById(
    id: string,
  ): TransformResult['map'] | undefined {
    return this.browser?.moduleGraph.getModuleById(id)?.transformResult?.map
  }

  get reporters() {
    return this.ctx.reporters
  }

  async globTestFiles(filters: string[] = []) {
    const dir = this.config.dir || this.config.root

    const { include, exclude, includeSource } = this.config
    const typecheck = this.config.typecheck

    const [testFiles, typecheckTestFiles] = await Promise.all([
      typecheck.enabled && typecheck.only
        ? []
        : this.globAllTestFiles(include, exclude, includeSource, dir),
      typecheck.enabled
        ? this.globFiles(typecheck.include, typecheck.exclude, dir)
        : [],
    ])

    return this.filterFiles(
      [...testFiles, ...typecheckTestFiles],
      filters,
      dir,
    )
  }

  async globAllTestFiles(
    include: string[],
    exclude: string[],
    includeSource: string[] | undefined,
    cwd: string,
  ) {
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
            if (this.isInSourceTestFile(code)) {
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
    if (mm.isMatch(relativeId, this.config.exclude)) {
      return false
    }
    if (mm.isMatch(relativeId, this.config.include)) {
      return true
    }
    if (
      this.config.includeSource?.length
      && mm.isMatch(relativeId, this.config.includeSource)
    ) {
      source = source || (await fs.readFile(id, 'utf-8'))
      return this.isInSourceTestFile(source)
    }
    return false
  }

  isInSourceTestFile(code: string) {
    return code.includes('import.meta.vitest')
  }

  filterFiles(testFiles: string[], filters: string[], dir: string) {
    if (filters.length && process.platform === 'win32') {
      filters = filters.map(f => toNamespacedPath(f))
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

  async initBrowserServer(configFile: string | undefined) {
    if (!this.isBrowserEnabled()) {
      return
    }
    await this.browser?.close()
    this.browser = await createBrowserServer(this, configFile)
  }

  static createBasicProject(ctx: Vitest) {
    const project = new WorkspaceProject(
      ctx.config.name || ctx.config.root,
      ctx,
    )
    project.vitenode = ctx.vitenode
    project.server = ctx.server
    project.runner = ctx.runner
    project.config = ctx.config
    return project
  }

  static async createCoreProject(ctx: Vitest) {
    const project = WorkspaceProject.createBasicProject(ctx)
    await project.initBrowserServer(ctx.server.config.configFile)
    return project
  }

  async setServer(options: UserConfig, server: ViteDevServer) {
    this.config = resolveConfig(
      this.ctx.mode,
      {
        ...options,
        coverage: this.ctx.config.coverage,
      },
      server.config,
      this.ctx.logger,
    )

    this.server = server

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

    await this.initBrowserServer(this.server.config.configFile)
  }

  isBrowserEnabled() {
    return isBrowserEnabled(this.config)
  }

  getSerializableConfig() {
    const optimizer = this.config.deps?.optimizer
    const poolOptions = this.config.poolOptions

    // Resolve from server.config to avoid comparing against default value
    const isolate = this.server?.config?.test?.isolate

    return deepMerge(
      {
        ...this.config,

        poolOptions: {
          forks: {
            singleFork:
              poolOptions?.forks?.singleFork
              ?? this.ctx.config.poolOptions?.forks?.singleFork
              ?? false,
            isolate:
              poolOptions?.forks?.isolate
              ?? isolate
              ?? this.ctx.config.poolOptions?.forks?.isolate
              ?? true,
          },
          threads: {
            singleThread:
              poolOptions?.threads?.singleThread
              ?? this.ctx.config.poolOptions?.threads?.singleThread
              ?? false,
            isolate:
              poolOptions?.threads?.isolate
              ?? isolate
              ?? this.ctx.config.poolOptions?.threads?.isolate
              ?? true,
          },
          vmThreads: {
            singleThread:
              poolOptions?.vmThreads?.singleThread
              ?? this.ctx.config.poolOptions?.vmThreads?.singleThread
              ?? false,
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
          expand:
            this.config.snapshotOptions.expand
            ?? this.ctx.config.snapshotOptions.expand,
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
        includeTaskLocation:
          this.config.includeTaskLocation
          ?? this.ctx.config.includeTaskLocation,
        env: {
          ...this.server?.config.env,
          ...this.config.env,
        },
        browser: {
          ...this.ctx.config.browser,
          orchestratorScripts: [],
          testerScripts: [],
          commands: {},
        },
        printConsoleTrace:
          this.config.printConsoleTrace ?? this.ctx.config.printConsoleTrace,
      },
      this.ctx.configOverride || ({} as any),
    ) as ResolvedConfig
  }

  close() {
    if (!this.closingPromise) {
      this.closingPromise = Promise.all(
        [
          this.server.close(),
          this.typechecker?.stop(),
          this.browser?.close(),
          this.clearTmpDir(),
        ].filter(Boolean),
      ).then(() => (this._provided = {} as any))
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
    if (!this.isBrowserEnabled()) {
      return
    }
    if (this.browserProvider) {
      return
    }
    const Provider = await getBrowserProvider(this.config.browser, this)
    this.browserProvider = new Provider()
    const browser = this.config.browser.name
    const supportedBrowsers = this.browserProvider.getSupportedBrowsers()
    if (!browser) {
      throw new Error(
        `[${this.getName()}] Browser name is required. Please, set \`test.browser.name\` option manually.`,
      )
    }
    if (supportedBrowsers.length && !supportedBrowsers.includes(browser)) {
      throw new Error(
        `[${this.getName()}] Browser "${browser}" is not supported by the browser provider "${
          this.browserProvider.name
        }". Supported browsers: ${supportedBrowsers.join(', ')}.`,
      )
    }
    const providerOptions = this.config.browser.providerOptions
    await this.browserProvider.initialize(this, {
      browser,
      options: providerOptions,
    })
  }
}
