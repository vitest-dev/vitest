import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import type { BrowserScript, WorkspaceProject } from 'vitest/node'
import type { Manifest, ViteDevServer } from 'vite'
import { join, resolve } from 'pathe'
import { slash } from '@vitest/utils'
import type { ResolvedConfig } from 'vitest'

export class BrowserServerState {
  public faviconUrl: string
  public prefixTesterUrl: string

  public orchestratorScripts: string | undefined
  public testerScripts: string | undefined

  public manifest: Promise<Manifest> | Manifest
  public testerHtml: Promise<string> | string
  public orchestratorHtml: Promise<string> | string
  public injectorJs: Promise<string> | string

  constructor(
    public project: WorkspaceProject,
    public server: ViteDevServer,
    public base: string,
  ) {
    const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
    const distRoot = resolve(pkgRoot, 'dist')

    this.prefixTesterUrl = `${base}__vitest_test__/__test__/`
    this.faviconUrl = `${base}favicon.svg`

    this.manifest = (async () => {
      return JSON.parse(
        await readFile(`${distRoot}/client/.vite/manifest.json`, 'utf8'),
      )
    })().then(manifest => (this.manifest = manifest))

    this.testerHtml = readFile(
      resolve(distRoot, 'client/tester.html'),
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
    return { contextId, testFile }
  }

  async formatScripts(
    scripts: BrowserScript[] | undefined,
  ) {
    if (!scripts?.length) {
      return ''
    }
    const server = this.server
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
