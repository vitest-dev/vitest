import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'
import type {
  BrowserProvider,
  BrowserScript,
  CDPSession,
  BrowserServer as IBrowserServer,
  Vite,
  WorkspaceProject,
} from 'vitest/node'
import { join, resolve } from 'pathe'
import type { ErrorWithDiff } from '@vitest/utils'
import { slash } from '@vitest/utils'
import { type StackTraceParserOptions, parseErrorStacktrace, parseStacktrace } from '@vitest/utils/source-map'
import type { SerializedConfig } from 'vitest'
import type { HtmlTagDescriptor } from 'vite'
import { BrowserServerState } from './state'
import { getBrowserProvider } from './utils'
import { BrowserServerCDPHandler } from './cdp'

export class BrowserServer implements IBrowserServer {
  public faviconUrl: string
  public prefixTesterUrl: string

  public orchestratorScripts: string | undefined
  public testerScripts: HtmlTagDescriptor[] | undefined

  public manifest: Promise<Vite.Manifest> | Vite.Manifest
  public testerHtml: Promise<string> | string
  public testerFilepath: string
  public orchestratorHtml: Promise<string> | string
  public injectorJs: Promise<string> | string
  public errorCatcherUrl: string
  public locatorsUrl: string | undefined
  public stateJs: Promise<string> | string

  public state: BrowserServerState
  public provider!: BrowserProvider

  public vite!: Vite.ViteDevServer

  private stackTraceOptions: StackTraceParserOptions

  constructor(
    public project: WorkspaceProject,
    public base: string,
  ) {
    this.stackTraceOptions = {
      frameFilter: project.config.onStackTrace,
      getSourceMap: (id) => {
        const result = this.vite.moduleGraph.getModuleById(id)?.transformResult
        return result?.map
      },
      getFileName: (id) => {
        const mod = this.vite.moduleGraph.getModuleById(id)
        if (mod?.file) {
          return mod.file
        }
        const modUrl = this.vite.moduleGraph.urlToModuleMap.get(id)
        if (modUrl?.file) {
          return modUrl.file
        }
        return id
      },
    }

    this.state = new BrowserServerState()

    const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
    const distRoot = resolve(pkgRoot, 'dist')

    this.prefixTesterUrl = `${base}__vitest_test__/__test__/`
    this.faviconUrl = `${base}__vitest__/favicon.svg`

    this.manifest = (async () => {
      return JSON.parse(
        await readFile(`${distRoot}/client/.vite/manifest.json`, 'utf8'),
      )
    })().then(manifest => (this.manifest = manifest))

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
    this.orchestratorHtml = (project.config.browser.ui
      ? readFile(resolve(distRoot, 'client/__vitest__/index.html'), 'utf8')
      : readFile(resolve(distRoot, 'client/orchestrator.html'), 'utf8'))
      .then(html => (this.orchestratorHtml = html))
    this.injectorJs = readFile(
      resolve(distRoot, 'client/esm-client-injector.js'),
      'utf8',
    ).then(js => (this.injectorJs = js))
    this.errorCatcherUrl = join('/@fs/', resolve(distRoot, 'client/error-catcher.js'))

    const builtinProviders = ['playwright', 'webdriverio', 'preview']
    const providerName = project.config.browser.provider || 'preview'
    if (builtinProviders.includes(providerName)) {
      this.locatorsUrl = join('/@fs/', distRoot, 'locators', `${providerName}.js`)
    }
    this.stateJs = readFile(
      resolve(distRoot, 'state.js'),
      'utf-8',
    ).then(js => (this.stateJs = js))
  }

  setServer(server: Vite.ViteDevServer) {
    this.vite = server
  }

  getSerializableConfig() {
    const config = wrapConfig(this.project.getSerializableConfig())
    config.env ??= {}
    config.env.VITEST_BROWSER_DEBUG = process.env.VITEST_BROWSER_DEBUG || ''
    return config
  }

  resolveTesterUrl(pathname: string) {
    const [contextId, testFile] = pathname
      .slice(this.prefixTesterUrl.length)
      .split('/')
    const decodedTestFile = decodeURIComponent(testFile)
    return { contextId, testFile: decodedTestFile }
  }

  async formatScripts(
    scripts: BrowserScript[] | undefined,
  ) {
    if (!scripts?.length) {
      return []
    }
    const server = this.vite
    const promises = scripts.map(
      async ({ content, src, async, id, type = 'module' }, index): Promise<HtmlTagDescriptor> => {
        const srcLink = (src ? (await server.pluginContainer.resolveId(src))?.id : undefined) || src
        const transformId = srcLink || join(server.config.root, `virtual__${id || `injected-${index}.js`}`)
        await server.moduleGraph.ensureEntryFromUrl(transformId)
        const contentProcessed
          = content && type === 'module'
            ? (await server.pluginContainer.transform(content, transformId)).code
            : content
        return {
          tag: 'script',
          attrs: {
            type,
            ...(async ? { async: '' } : {}),
            ...(srcLink ? { src: slash(`/@fs/${srcLink}`) } : {}),
          },
          injectTo: 'head',
          children: contentProcessed || '',
        }
      },
    )
    return (await Promise.all(promises))
  }

  async initBrowserProvider() {
    if (this.provider) {
      return
    }
    const Provider = await getBrowserProvider(this.project.config.browser, this.project)
    this.provider = new Provider()
    const browser = this.project.config.browser.name
    if (!browser) {
      throw new Error(
        `[${this.project.getName()}] Browser name is required. Please, set \`test.browser.name\` option manually.`,
      )
    }
    const supportedBrowsers = this.provider.getSupportedBrowsers()
    if (supportedBrowsers.length && !supportedBrowsers.includes(browser)) {
      throw new Error(
        `[${this.project.getName()}] Browser "${browser}" is not supported by the browser provider "${
          this.provider.name
        }". Supported browsers: ${supportedBrowsers.join(', ')}.`,
      )
    }
    const providerOptions = this.project.config.browser.providerOptions
    await this.provider.initialize(this.project, {
      browser,
      options: providerOptions,
    })
  }

  public parseErrorStacktrace(
    e: ErrorWithDiff,
    options: StackTraceParserOptions = {},
  ) {
    return parseErrorStacktrace(e, {
      ...this.stackTraceOptions,
      ...options,
    })
  }

  public parseStacktrace(
    trace: string,
    options: StackTraceParserOptions = {},
  ) {
    return parseStacktrace(trace, {
      ...this.stackTraceOptions,
      ...options,
    })
  }

  private cdpSessionsPromises = new Map<string, Promise<CDPSession>>()

  async ensureCDPHandler(contextId: string, sessionId: string) {
    const cachedHandler = this.state.cdps.get(sessionId)
    if (cachedHandler) {
      return cachedHandler
    }

    const provider = this.provider
    if (!provider.getCDPSession) {
      throw new Error(`CDP is not supported by the provider "${provider.name}".`)
    }

    const promise = this.cdpSessionsPromises.get(sessionId) ?? await (async () => {
      const promise = provider.getCDPSession!(contextId).finally(() => {
        this.cdpSessionsPromises.delete(sessionId)
      })
      this.cdpSessionsPromises.set(sessionId, promise)
      return promise
    })()

    const session = await promise
    const rpc = this.state.testers.get(sessionId)
    if (!rpc) {
      throw new Error(`Tester RPC "${sessionId}" was not established.`)
    }

    const handler = new BrowserServerCDPHandler(session, rpc)
    this.state.cdps.set(
      sessionId,
      handler,
    )
    return handler
  }

  async close() {
    await this.vite.close()
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
