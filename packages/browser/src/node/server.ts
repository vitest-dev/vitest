import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type {
  BrowserProvider,
  BrowserScript,
  BrowserServer as IBrowserServer,
  Vite,
  WorkspaceProject,
} from 'vitest/node'
import { join, resolve } from 'pathe'
import { slash } from '@vitest/utils'
import type { ResolvedConfig } from 'vitest'
import { BrowserServerState } from './state'
import { getBrowserProvider } from './utils'

export class BrowserServer implements IBrowserServer {
  public faviconUrl: string
  public prefixTesterUrl: string

  public orchestratorScripts: string | undefined
  public testerScripts: string | undefined

  public manifest: Promise<Vite.Manifest> | Vite.Manifest
  public testerHtml: Promise<string> | string
  public orchestratorHtml: Promise<string> | string
  public injectorJs: Promise<string> | string
  public stateJs: Promise<string> | string

  public state: BrowserServerState
  public provider!: BrowserProvider

  public vite!: Vite.ViteDevServer

  constructor(
    public project: WorkspaceProject,
    public base: string,
  ) {
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

    this.testerHtml = readFile(
      resolve(distRoot, 'client/tester/tester.html'),
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
      return ''
    }
    const server = this.vite
    const promises = scripts.map(
      async ({ content, src, async, id, type = 'module' }, index) => {
        const srcLink = (src ? (await server.pluginContainer.resolveId(src))?.id : undefined) || src
        const transformId = srcLink || join(server.config.root, `virtual__${id || `injected-${index}.js`}`)
        await server.moduleGraph.ensureEntryFromUrl(transformId)
        const contentProcessed
          = content && type === 'module'
            ? (await server.pluginContainer.transform(content, transformId)).code
            : content
        return `<script type="${type}"${async ? ' async' : ''}${
          srcLink ? ` src="${slash(`/@fs/${srcLink}`)}"` : ''
        }>${contentProcessed || ''}</script>`
      },
    )
    return (await Promise.all(promises)).join('\n')
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

  async close() {
    await this.vite.close()
  }
}

function wrapConfig(config: ResolvedConfig): ResolvedConfig {
  return {
    ...config,
    // workaround RegExp serialization
    testNamePattern: config.testNamePattern
      ? (config.testNamePattern.toString() as any as RegExp)
      : undefined,
  }
}
