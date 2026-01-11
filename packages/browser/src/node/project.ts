import type { StackTraceParserOptions } from '@vitest/utils/source-map'
import type { ViteDevServer } from 'vite'
import type { ParsedStack, SerializedConfig, TestError } from 'vitest'
import type { BrowserCommands } from 'vitest/browser'
import type {
  BrowserCommand,
  BrowserCommandContext,
  BrowserProvider,
  ProjectBrowser as IProjectBrowser,
  ResolvedConfig,
  TestProject,
  Vitest,
} from 'vitest/node'
import type { ParentBrowserProject } from './projectParent'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve } from 'pathe'
import { BrowserServerState } from './state'
import { getBrowserProvider } from './utils'

export class ProjectBrowser implements IProjectBrowser {
  public testerHtml: Promise<string> | string
  public testerFilepath: string

  public provider!: BrowserProvider
  public vitest: Vitest
  public config: ResolvedConfig
  public children: Set<ProjectBrowser> = new Set<ProjectBrowser>()

  public parent!: ParentBrowserProject

  public state: BrowserServerState = new BrowserServerState()

  constructor(
    public project: TestProject,
    public base: string,
  ) {
    this.vitest = project.vitest
    this.config = project.config

    const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
    const distRoot = resolve(pkgRoot, 'dist')

    const testerHtmlPath = project.config.browser.testerHtmlPath
      ? resolve(project.config.root, project.config.browser.testerHtmlPath)
      : resolve(distRoot, 'client/tester/tester.html')
    if (!existsSync(testerHtmlPath)) {
      throw new Error(`Tester HTML file "${testerHtmlPath}" doesn't exist.`)
    }
    this.testerFilepath = testerHtmlPath

    this.testerHtml = readFile(
      testerHtmlPath,
      'utf8',
    ).then(html => (this.testerHtml = html))
  }

  get vite(): ViteDevServer {
    return this.parent.vite
  }

  private commands = {} as Record<string, BrowserCommand<any, any>>

  public registerCommand<K extends keyof BrowserCommands>(
    name: K,
    cb: BrowserCommand<
      Parameters<BrowserCommands[K]>,
      ReturnType<BrowserCommands[K]>
    >,
  ): void {
    if (!/^[a-z_$][\w$]*$/i.test(name)) {
      throw new Error(
        `Invalid command name "${name}". Only alphanumeric characters, $ and _ are allowed.`,
      )
    }
    this.commands[name] = cb
  }

  public triggerCommand = (<K extends keyof BrowserCommand>(
    name: K,
    context: BrowserCommandContext,
    ...args: Parameters<BrowserCommands[K]>
  ): ReturnType<BrowserCommands[K]> => {
    if (name in this.commands) {
      return this.commands[name](context, ...args)
    }
    if (name in this.parent.commands) {
      return this.parent.commands[name](context, ...args)
    }
    throw new Error(`Provider ${this.provider.name} does not support command "${name}".`)
  }) as any

  wrapSerializedConfig(): SerializedConfig {
    const config = wrapConfig(this.project.serializedConfig)
    config.env ??= {}
    config.env.VITEST_BROWSER_DEBUG = process.env.VITEST_BROWSER_DEBUG || ''
    return config
  }

  async initBrowserProvider(project: TestProject): Promise<void> {
    if (this.provider) {
      return
    }
    this.provider = await getBrowserProvider(project.config.browser, project)
    if (this.provider.initScripts) {
      this.parent.initScripts = this.provider.initScripts
      // make sure the script can be imported
      const allow = this.parent.vite.config.server.fs.allow
      this.provider.initScripts.forEach((script) => {
        if (!allow.includes(script)) {
          allow.push(script)
        }
      })
    }
  }

  public parseErrorStacktrace(
    e: TestError,
    options: StackTraceParserOptions = {},
  ): ParsedStack[] {
    return this.parent.parseErrorStacktrace(e, options)
  }

  public parseStacktrace(
    trace: string,
    options: StackTraceParserOptions = {},
  ): ParsedStack[] {
    return this.parent.parseStacktrace(trace, options)
  }

  async close(): Promise<void> {
    await this.parent.vite.close()
  }
}

function wrapConfig(config: SerializedConfig): SerializedConfig {
  return {
    ...config,
    // workaround RegExp serialization
    testNamePattern: config.testNamePattern
      ? (config.testNamePattern.toString() as any as RegExp)
      : undefined,
  }
}
