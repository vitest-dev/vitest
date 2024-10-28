import type {
  TransformResult,
  ViteDevServer,
  InlineConfig as ViteInlineConfig,
} from 'vite'
import type { Typechecker } from '../typecheck/typechecker'
import type { ProvidedContext } from '../types/general'
import type { Vitest } from './core'
import type { GlobalSetupFile } from './globalSetup'
import type { WorkspaceSpec as DeprecatedWorkspaceSpec } from './pool'
import type { BrowserServer } from './types/browser'
import type {
  ResolvedConfig,
  SerializedConfig,
  UserConfig,
  UserWorkspaceConfig,
} from './types/config'
import { promises as fs } from 'node:fs'
import { rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { deepMerge, nanoid, slash } from '@vitest/utils'
import fg from 'fast-glob'
import mm from 'micromatch'
import {
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from 'pathe'
import { ViteNodeRunner } from 'vite-node/client'
import { ViteNodeServer } from 'vite-node/server'
import { setup } from '../api/setup'
import { isBrowserEnabled, resolveConfig } from './config/resolveConfig'
import { serializeConfig } from './config/serializeConfig'
import { loadGlobalSetupFiles } from './globalSetup'
import { CoverageTransform } from './plugins/coverageTransform'
import { MocksPlugins } from './plugins/mocks'
import { WorkspaceVitestPlugin } from './plugins/workspace'
import { TestProject } from './reported-workspace-project'
import { TestSpecification } from './spec'
import { createViteServer } from './vite'

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

  const root
    = options.root
    || (typeof workspacePath === 'number'
      ? undefined
      : workspacePath.endsWith('/')
        ? workspacePath
        : dirname(workspacePath))

  const configFile = options.extends
    ? resolve(dirname(options.workspaceConfigPath), options.extends)
    : typeof workspacePath === 'number' || workspacePath.endsWith('/')
      ? false
      : workspacePath

  const config: ViteInlineConfig = {
    ...options,
    root,
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
  browser?: BrowserServer
  typechecker?: Typechecker

  closingPromise: Promise<unknown> | undefined

  testFilesList: string[] | null = null
  typecheckFilesList: string[] | null = null

  public testProject!: TestProject

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

  provide<T extends keyof ProvidedContext & string>(
    key: T,
    value: ProvidedContext[T],
  ) {
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

  public createSpec(moduleId: string, pool: string): DeprecatedWorkspaceSpec {
    return new TestSpecification(this, moduleId, pool) as DeprecatedWorkspaceSpec
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
        provide: (key, value) => this.provide(key, value),
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
      || this.browser?.vite.moduleGraph.getModulesByFile(file)
    return set || new Set()
  }

  getModuleById(id: string) {
    return (
      this.server.moduleGraph.getModuleById(id)
      || this.browser?.vite.moduleGraph.getModuleById(id)
    )
  }

  getSourceMapModuleById(id: string): TransformResult['map'] | undefined {
    const mod = this.server.moduleGraph.getModuleById(id)
    return mod?.ssrTransformResult?.map || mod?.transformResult?.map
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

  isTypecheckFile(id: string) {
    return this.typecheckFilesList && this.typecheckFilesList.includes(id)
  }

  async globFiles(include: string[], exclude: string[], cwd: string) {
    const globOptions: fg.Options = {
      dot: true,
      cwd,
      ignore: exclude,
    }

    const files = await fg(include, globOptions)
    // keep the slashes consistent with Vite
    // we are not using the pathe here because it normalizes the drive letter on Windows
    // and we want to keep it the same as working dir
    return files.map(file => slash(path.resolve(cwd, file)))
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

  async initBrowserServer(configFile: string | undefined) {
    if (!this.isBrowserEnabled()) {
      return
    }
    await this.ctx.packageInstaller.ensureInstalled('@vitest/browser', this.config.root, this.ctx.version)
    const { createBrowserServer } = await import('@vitest/browser')
    await this.browser?.close()
    const browser = await createBrowserServer(
      this,
      configFile,
      [...MocksPlugins()],
      [CoverageTransform(this.ctx)],
    )
    this.browser = browser
    if (this.config.browser.ui) {
      setup(this.ctx, browser.vite)
    }
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
    for (const _providedKey in ctx.config.provide) {
      const providedKey = _providedKey as keyof ProvidedContext
      // type is very strict here, so we cast it to any
      (project.provide as (key: string, value: unknown) => void)(
        providedKey,
        ctx.config.provide[providedKey],
      )
    }
    project.testProject = new TestProject(project)
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
    for (const _providedKey in this.config.provide) {
      const providedKey = _providedKey as keyof ProvidedContext
      // type is very strict here, so we cast it to any
      (this.provide as (key: string, value: unknown) => void)(
        providedKey,
        this.config.provide[providedKey],
      )
    }

    this.testProject = new TestProject(this)

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

  isBrowserEnabled(): boolean {
    return isBrowserEnabled(this.config)
  }

  getSerializableConfig(): SerializedConfig {
    // TODO: serialize the config _once_ or when needed
    const config = serializeConfig(
      this.config,
      this.ctx.config,
      this.server.config,
    )
    if (!this.ctx.configOverride) {
      return config
    }
    return deepMerge(
      config,
      this.ctx.configOverride,
    )
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
      await rm(this.tmpDir, { recursive: true })
    }
    catch {}
  }

  async initBrowserProvider() {
    if (!this.isBrowserEnabled()) {
      return
    }
    await this.browser?.initBrowserProvider()
  }
}
