import type { StackTraceParserOptions } from '@vitest/utils/source-map'
import type { ErrorWithDiff, SerializedConfig } from 'vitest'
import type {
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
  public locatorsUrl: string | undefined

  public provider!: BrowserProvider
  public vitest: Vitest
  public config: ResolvedConfig
  public children = new Set<ProjectBrowser>()

  public parent!: ParentBrowserProject

  public state = new BrowserServerState()

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

  get vite() {
    return this.parent.vite
  }

  wrapSerializedConfig() {
    const config = wrapConfig(this.project.serializedConfig)
    config.env ??= {}
    config.env.VITEST_BROWSER_DEBUG = process.env.VITEST_BROWSER_DEBUG || ''
    return config
  }

  async initBrowserProvider(project: TestProject) {
    if (this.provider) {
      return
    }
    const Provider = await getBrowserProvider(project.config.browser, project)
    this.provider = new Provider()
    const browser = project.config.browser.name
    const name = project.name ? `[${project.name}] ` : ''
    if (!browser) {
      throw new Error(
        `${name}Browser name is required. Please, set \`test.browser.instances[].browser\` option manually.`,
      )
    }
    const supportedBrowsers = this.provider.getSupportedBrowsers()
    if (supportedBrowsers.length && !supportedBrowsers.includes(browser)) {
      throw new Error(
        `${name}Browser "${browser}" is not supported by the browser provider "${
          this.provider.name
        }". Supported browsers: ${supportedBrowsers.join(', ')}.`,
      )
    }
    const providerOptions = project.config.browser.providerOptions
    await this.provider.initialize(project, {
      browser,
      options: providerOptions,
    })
  }

  public parseErrorStacktrace(
    e: ErrorWithDiff,
    options: StackTraceParserOptions = {},
  ) {
    return this.parent.parseErrorStacktrace(e, options)
  }

  public parseStacktrace(
    trace: string,
    options: StackTraceParserOptions = {},
  ) {
    return this.parent.parseStacktrace(trace, options)
  }

  async close() {
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
