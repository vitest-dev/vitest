import type { HtmlTagDescriptor } from 'vite'
import type { ErrorWithDiff, ParsedStack } from 'vitest'
import type {
  BrowserCommand,
  BrowserScript,
  CDPSession,
  ResolvedConfig,
  TestProject,
  Vite,
  Vitest,
} from 'vitest/node'
import type { BrowserServerState } from './state'
import { readFile } from 'node:fs/promises'
import { parseErrorStacktrace, parseStacktrace, type StackTraceParserOptions } from '@vitest/utils/source-map'
import { join, resolve } from 'pathe'
import { BrowserServerCDPHandler } from './cdp'
import builtinCommands from './commands/index'
import { distRoot } from './constants'
import { ProjectBrowser } from './project'
import { slash } from './utils'

export class ParentBrowserProject {
  public orchestratorScripts: string | undefined
  public testerScripts: HtmlTagDescriptor[] | undefined

  public faviconUrl: string
  public prefixTesterUrl: string
  public manifest: Promise<Vite.Manifest> | Vite.Manifest

  public vite!: Vite.ViteDevServer
  private stackTraceOptions: StackTraceParserOptions
  public orchestratorHtml: Promise<string> | string
  public injectorJs: Promise<string> | string
  public errorCatcherUrl: string
  public locatorsUrl: string | undefined
  public stateJs: Promise<string> | string

  public commands: Record<string, BrowserCommand<any>> = {}
  public children = new Set<ProjectBrowser>()
  public vitest: Vitest

  public config: ResolvedConfig

  constructor(
    public project: TestProject,
    public base: string,
  ) {
    this.vitest = project.vitest
    this.config = project.config
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

    for (const [name, command] of Object.entries(builtinCommands)) {
      this.commands[name] ??= command
    }

    // validate names because they can't be used as identifiers
    for (const command in project.config.browser.commands) {
      if (!/^[a-z_$][\w$]*$/i.test(command)) {
        throw new Error(
          `Invalid command name "${command}". Only alphanumeric characters, $ and _ are allowed.`,
        )
      }
      this.commands[command] = project.config.browser.commands[command]
    }

    this.prefixTesterUrl = `${base}__vitest_test__/__test__/`
    this.faviconUrl = `${base}__vitest__/favicon.svg`

    this.manifest = (async () => {
      return JSON.parse(
        await readFile(`${distRoot}/client/.vite/manifest.json`, 'utf8'),
      )
    })().then(manifest => (this.manifest = manifest))

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

  public setServer(vite: Vite.ViteDevServer) {
    this.vite = vite
  }

  public spawn(project: TestProject): ProjectBrowser {
    if (!this.vite) {
      throw new Error(`Cannot spawn child server without a parent dev server.`)
    }
    const clone = new ProjectBrowser(
      project,
      '/',
    )
    clone.parent = this
    this.children.add(clone)
    return clone
  }

  public parseErrorStacktrace(
    e: ErrorWithDiff,
    options: StackTraceParserOptions = {},
  ): ParsedStack[] {
    return parseErrorStacktrace(e, {
      ...this.stackTraceOptions,
      ...options,
    })
  }

  public parseStacktrace(
    trace: string,
    options: StackTraceParserOptions = {},
  ): ParsedStack[] {
    return parseStacktrace(trace, {
      ...this.stackTraceOptions,
      ...options,
    })
  }

  public readonly cdps = new Map<string, BrowserServerCDPHandler>()
  private cdpSessionsPromises = new Map<string, Promise<CDPSession>>()

  async ensureCDPHandler(sessionId: string, rpcId: string) {
    const cachedHandler = this.cdps.get(rpcId)
    if (cachedHandler) {
      return cachedHandler
    }
    const browserSession = this.vitest._browserSessions.getSession(sessionId)
    if (!browserSession) {
      throw new Error(`Session "${sessionId}" not found.`)
    }

    const browser = browserSession.project.browser!
    const provider = browser.provider
    if (!provider) {
      throw new Error(`Browser provider is not defined for the project "${browserSession.project.name}".`)
    }
    if (!provider.getCDPSession) {
      throw new Error(`CDP is not supported by the provider "${provider.name}".`)
    }

    const promise = this.cdpSessionsPromises.get(rpcId) ?? await (async () => {
      const promise = provider.getCDPSession!(sessionId).finally(() => {
        this.cdpSessionsPromises.delete(rpcId)
      })
      this.cdpSessionsPromises.set(rpcId, promise)
      return promise
    })()

    const session = await promise
    const rpc = (browser.state as BrowserServerState).testers.get(rpcId)
    if (!rpc) {
      throw new Error(`Tester RPC "${rpcId}" was not established.`)
    }

    const handler = new BrowserServerCDPHandler(session, rpc)
    this.cdps.set(
      rpcId,
      handler,
    )
    return handler
  }

  removeCDPHandler(sessionId: string) {
    this.cdps.delete(sessionId)
  }

  async formatScripts(scripts: BrowserScript[] | undefined) {
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
            ...(srcLink
              ? {
                  src: srcLink.startsWith('http') ? srcLink : slash(`/@fs/${srcLink}`),
                }
              : {}),
          },
          injectTo: 'head',
          children: contentProcessed || '',
        }
      },
    )
    return (await Promise.all(promises))
  }

  resolveTesterUrl(pathname: string) {
    const [sessionId, testFile] = pathname
      .slice(this.prefixTesterUrl.length)
      .split('/')
    const decodedTestFile = decodeURIComponent(testFile)
    return { sessionId, testFile: decodedTestFile }
  }
}
