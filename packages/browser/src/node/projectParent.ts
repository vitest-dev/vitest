import type { StackTraceParserOptions } from '@vitest/utils/source-map'
import type { HtmlTagDescriptor } from 'vite'
import type { ParsedStack, TestError } from 'vitest'
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
import { parseErrorStacktrace, parseStacktrace } from '@vitest/utils/source-map'
import { extractSourcemapFromFile } from '@vitest/utils/source-map/node'
import { join, resolve } from 'pathe'
import { BrowserServerCDPHandler } from './cdp'
import builtinCommands from './commands/index'
import { distRoot } from './constants'
import { ProjectBrowser } from './project'
import { slash } from './utils'

export class ParentBrowserProject {
  public orchestratorScripts: string | undefined

  public faviconUrl: string
  public prefixOrchestratorUrl: string
  public prefixTesterUrl: string
  public manifest: Promise<Vite.Manifest> | Vite.Manifest

  public vite!: Vite.ViteDevServer
  private stackTraceOptions: StackTraceParserOptions
  public orchestratorHtml: Promise<string> | string
  public injectorJs: Promise<string> | string
  public errorCatcherUrl: string
  public locatorsUrl: string | undefined
  public matchersUrl: string
  public stateJs: Promise<string> | string

  public initScripts: string[] = []

  public commands: Record<string, BrowserCommand<any>> = {}
  public children: Set<ProjectBrowser> = new Set()
  public vitest: Vitest

  public config: ResolvedConfig

  // cache for non-vite source maps
  private sourceMapCache = new Map<string, any>()

  constructor(
    public project: TestProject,
    public base: string,
  ) {
    this.vitest = project.vitest
    this.config = project.config
    this.stackTraceOptions = {
      frameFilter: project.config.onStackTrace,
      getSourceMap: (id) => {
        if (this.sourceMapCache.has(id)) {
          return this.sourceMapCache.get(id)
        }

        const result = this.vite.moduleGraph.getModuleById(id)?.transformResult
        // handle non-inline source map such as pre-bundled deps in node_modules/.vite
        if (result && !result.map) {
          const filePath = id.split('?')[0]
          const extracted = extractSourcemapFromFile(result.code, filePath)
          this.sourceMapCache.set(id, extracted?.map)
          return extracted?.map
        }

        this.sourceMapCache.set(id, result?.map)
        return result?.map
      },
      getUrlId: (id) => {
        const moduleGraph = this.vite.environments.client.moduleGraph
        const mod = moduleGraph.getModuleById(id)
        if (mod) {
          return id
        }
        const resolvedPath = resolve(this.vite.config.root, id.slice(1))
        const modUrl = moduleGraph.getModuleById(resolvedPath)
        if (modUrl) {
          return resolvedPath
        }
        // some browsers (looking at you, safari) don't report queries in stack traces
        // the next best thing is to try the first id that this file resolves to
        const files = moduleGraph.getModulesByFile(resolvedPath)
        if (files && files.size) {
          return files.values().next().value!.id!
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

    this.prefixTesterUrl = `${base || '/'}`
    this.prefixOrchestratorUrl = `${base}__vitest_test__/`
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

    this.matchersUrl = join('/@fs/', distRoot, 'expect-element.js')
    this.stateJs = readFile(
      resolve(distRoot, 'state.js'),
      'utf-8',
    ).then(js => (this.stateJs = js))
  }

  public setServer(vite: Vite.ViteDevServer): void {
    this.vite = vite
  }

  public spawn(project: TestProject): ProjectBrowser {
    if (!this.vite) {
      throw new Error(`Cannot spawn child server without a parent dev server.`)
    }
    const clone = new ProjectBrowser(
      this,
      project,
      '/',
    )
    this.children.add(clone)
    return clone
  }

  public parseErrorStacktrace(
    e: TestError,
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

  public readonly cdps: Map<string, BrowserServerCDPHandler> = new Map()
  private cdpSessionsPromises = new Map<string, Promise<CDPSession>>()

  async ensureCDPHandler(sessionId: string, rpcId: string): Promise<BrowserServerCDPHandler> {
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

    const session = await this.cdpSessionsPromises.get(rpcId) ?? await (async () => {
      const promise = provider.getCDPSession!(sessionId).finally(() => {
        this.cdpSessionsPromises.delete(rpcId)
      })
      this.cdpSessionsPromises.set(rpcId, promise)
      return promise
    })()

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

  removeCDPHandler(sessionId: string): void {
    this.cdps.delete(sessionId)
  }

  async formatScripts(scripts: BrowserScript[] | undefined): Promise<HtmlTagDescriptor[]> {
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

  resolveTesterUrl(pathname: string): { sessionId: string; testFile: string } {
    const [sessionId, testFile] = pathname
      .slice(this.prefixTesterUrl.length)
      .split('/')
    const decodedTestFile = decodeURIComponent(testFile)
    return { sessionId, testFile: decodedTestFile }
  }
}
