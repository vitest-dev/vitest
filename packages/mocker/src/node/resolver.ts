import type { Rollup, ResolvedConfig as ViteConfig, ViteDevServer } from 'vite'
import type { ServerIdResolution, ServerMockResolution } from '../types'
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'pathe'
import { cleanUrl } from '../utils'
import { findMockRedirect } from './redirect'

export interface ServerResolverOptions {
  /**
   * @default ['/node_modules/']
   */
  moduleDirectories?: string[]
}

const VALID_ID_PREFIX = '/@id/'

export class ServerMockResolver {
  constructor(
    private server: ViteDevServer,
    private options: ServerResolverOptions = {},
  ) {}

  async resolveMock(
    rawId: string,
    importer: string,
    options: { mock: 'spy' | 'factory' | 'auto' },
  ): Promise<ServerMockResolution> {
    const { id, fsPath, external } = await this.resolveMockId(rawId, importer)
    const resolvedUrl = this.normalizeResolveIdToUrl({ id }).url

    if (options.mock === 'factory') {
      const manifest = getViteDepsManifest(this.server.config)
      const needsInterop = manifest?.[fsPath]?.needsInterop ?? false
      return { mockType: 'manual', resolvedId: id, resolvedUrl, needsInterop }
    }

    if (options.mock === 'spy') {
      return { mockType: 'autospy', resolvedId: id, resolvedUrl }
    }

    const redirectUrl = findMockRedirect(this.server.config.root, fsPath, external)

    return {
      mockType: redirectUrl === null ? 'automock' : 'redirect',
      redirectUrl,
      resolvedId: id,
      resolvedUrl,
    }
  }

  public invalidate(ids: string[]): void {
    ids.forEach((id) => {
      const moduleGraph = this.server.moduleGraph
      const module = moduleGraph.getModuleById(id)
      if (module) {
        module.transformResult = null
      }
    })
  }

  public async resolveId(id: string, importer?: string): Promise<ServerIdResolution | null> {
    const resolved = await this.server.pluginContainer.resolveId(
      id,
      importer,
      {
        ssr: false,
      },
    )
    if (!resolved) {
      return null
    }
    return this.normalizeResolveIdToUrl(resolved)
  }

  private normalizeResolveIdToUrl(resolved: { id: string }) {
    const isOptimized = resolved.id.startsWith(withTrailingSlash(this.server.config.cacheDir))
    let url: string
    // normalise the URL to be acceptable by the browser
    // https://github.com/vitejs/vite/blob/14027b0f2a9b01c14815c38aab22baf5b29594bb/packages/vite/src/node/plugins/importAnalysis.ts#L103
    const root = this.server.config.root
    if (resolved.id.startsWith(withTrailingSlash(root))) {
      url = resolved.id.slice(root.length)
    }
    else if (
      resolved.id !== '/@react-refresh'
      && isAbsolute(resolved.id)
      && existsSync(cleanUrl(resolved.id))
    ) {
      url = join('/@fs/', resolved.id)
    }
    else {
      url = resolved.id
    }
    if (url[0] !== '.' && url[0] !== '/') {
      url = resolved.id.startsWith(VALID_ID_PREFIX)
        ? resolved.id
        : VALID_ID_PREFIX + resolved.id.replace('\0', '__x00__')
    }
    return {
      id: resolved.id,
      url,
      optimized: isOptimized,
    }
  }

  private async resolveMockId(rawId: string, importer: string) {
    if (
      !this.server.moduleGraph.getModuleById(importer)
      && !importer.startsWith(this.server.config.root)
    ) {
      importer = join(this.server.config.root, importer)
    }
    const resolved = await this.server.pluginContainer.resolveId(
      rawId,
      importer,
      {
        ssr: false,
      },
    )
    return this.resolveModule(rawId, resolved)
  }

  private resolveModule(rawId: string, resolved: Rollup.PartialResolvedId | null) {
    const id = resolved?.id || rawId
    const external
      = !isAbsolute(id) || isModuleDirectory(this.options, id) ? rawId : null
    return {
      id,
      fsPath: cleanUrl(id),
      external,
    }
  }
}

function isModuleDirectory(config: ServerResolverOptions, path: string) {
  const moduleDirectories = config.moduleDirectories || [
    '/node_modules/',
  ]
  return moduleDirectories.some((dir: string) => path.includes(dir))
}

interface PartialManifest {
  [name: string]: {
    hash: string
    needsInterop: boolean
  }
}

const metadata = new WeakMap<ViteConfig, PartialManifest>()

function getViteDepsManifest(config: ViteConfig) {
  if (metadata.has(config)) {
    return metadata.get(config)!
  }
  const cacheDirPath = getDepsCacheDir(config)
  const metadataPath = resolve(cacheDirPath, '_metadata.json')
  if (!existsSync(metadataPath)) {
    return null
  }
  const { optimized } = JSON.parse(readFileSync(metadataPath, 'utf-8'))
  const newManifest: PartialManifest = {}
  for (const name in optimized) {
    const dep = optimized[name]
    const file = resolve(cacheDirPath, dep.file)
    newManifest[file] = {
      hash: dep.fileHash,
      needsInterop: dep.needsInterop,
    }
  }
  metadata.set(config, newManifest)
  return newManifest
}

function getDepsCacheDir(config: ViteConfig): string {
  return resolve(config.cacheDir, 'deps')
}

function withTrailingSlash(path: string): string {
  if (path[path.length - 1] !== '/') {
    return `${path}/`
  }

  return path
}
