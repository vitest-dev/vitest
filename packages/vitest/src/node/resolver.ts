import { pathToFileURL } from 'node:url'
import { readFile } from 'node:fs/promises'
import { moduleResolve as resolveImport } from 'import-meta-resolve'
import { isInternalRequest, normalizeModuleId } from 'vite-node/utils'
import { fileURLToPath } from 'mlly'
import { dirname, extname, normalize } from 'pathe'
import { transformWithEsbuild } from 'vite'
import type { FetchResult } from 'vite-node'
import { withInlineSourcemap } from 'vite-node/source-map'
import { getPackageInfo } from 'local-pkg'
import type { ViteNodeServer } from 'vite-node/server'
import { shouldExternalize } from 'vite-node/server'

export class VitestResolver {
  private importerToIdMap = new Map<string, Set<string>>()
  private idToImporterMap = new Map<string, Set<string>>()
  private pkgCache = new Map<string, { version: string; type?: 'module' | 'commonjs' }>()
  private conditions: Set<string>

  private externalizeCache = new Map<string, Promise<string | false>>()

  constructor(private vitenode: ViteNodeServer) {
    this.conditions = new Set(['node', 'import', ...vitenode.server.config.resolve.conditions])
  }

  private get server() {
    return this.vitenode.server
  }

  private get options() {
    return this.vitenode.options
  }

  fetchModule(id: string, strict = false) {
    if (strict)
      return this.fetchNodeModule(id)
    return this.fetchViteModule(id)
  }

  resolveId(id: string, importer = this.server.config.root, strict = false) {
    if (strict)
      return this.resolveNodeId(id, importer)
    return this.resolveViteId(id, importer)
  }

  async fetchNodeModule(id: string): Promise<FetchResult> {
    const externalize = await shouldExternalize(id, this.options.deps, this.externalizeCache)
    if (externalize)
      return { externalize }
    if (isInternalRequest(id)) {
      const result = await this.server.transformRequest(id, { ssr: true })
      return { code: result?.code }
    }
    id = normalizeModuleId(id)
    // file should always exist, otherwise it would throw in resolveId
    const { code, map } = await transformWithEsbuild(await readFile(id, 'utf-8'), id)
    const result = await this.server.ssrTransform(code, map, id)

    const sourcemap = this.options.sourcemap ?? 'inline'
    if (sourcemap === 'inline' && result && !id.includes('node_modules'))
      withInlineSourcemap(result)

    const format = await this._getPackageFormat(id)
    return { code: result?.code, format }
  }

  async resolveNodeId(path: string, importer: string) {
    path = normalizeModuleId(path)
    importer = normalizeModuleId(importer)
    const importerURL = pathToFileURL(importer)
    const originalPath = path
    // TS has a weird algorithm for resolving imports, and it requires js
    // but the file is probably .ts. if not, we try again with the original path
    path = path.replace(/\.(c|m)?js$/, '.$1ts')
    const preserveSymlinks = this.server.config.resolve.preserveSymlinks
    let url
    try {
      url = resolveImport(path, importerURL, this.conditions, preserveSymlinks)
    }
    catch (err: any) {
      if (err.code !== 'ERR_MODULE_NOT_FOUND')
        throw err
      url = resolveImport(originalPath, importerURL, this.conditions, preserveSymlinks)
    }
    let id = url.href
    if (id.startsWith('file://'))
      id = fileURLToPath(id)
    id = normalize(id)
    const importers = this.idToImporterMap.get(id) ?? new Set()
    importers.add(importer)
    this.idToImporterMap.set(id, importers)
    const imported = this.importerToIdMap.get(importer) ?? new Set()
    imported.add(id)
    this.importerToIdMap.set(importer, imported)
    return { id }
  }

  isSourceCode(id: string) {
    return this.importerToIdMap.has(id) || this.server.moduleGraph.getModuleById(id)
  }

  getImporters(id: string) {
    const mod = this.server.moduleGraph.getModuleById(id)
    if (mod)
      return Array.from(mod.importers).map(m => m.id)
    const importers = this.idToImporterMap.get(id) || []
    return Array.from(importers)
  }

  private _getCachedPackageInfo(url: string) {
    while (url) {
      const dir = dirname(url)
      if (url === dir)
        return null
      url = dir
      const cached = this.pkgCache.get(url)
      if (cached)
        return cached
    }
    return null
  }

  private async _getPackageFormat(fsPath: string) {
    switch (extname(fsPath)) {
      case '.cts':
      case '.cjs':
        return 'cjs'
      case '.mts':
      case '.mjs':
        return 'esm'
    }
    const pkg = await this.getPackageInfo(fsPath)
    return pkg?.type === 'module' ? 'esm' : 'cjs'
  }

  async getPackageInfo(url: string) {
    // TODO: clear cache on watcher change
    const info = this._getCachedPackageInfo(url)
    if (info)
      return info
    const pkg = await getPackageInfo(url)
    if (!pkg)
      return null
    const pkgPath = dirname(pkg.packageJsonPath)
    this.pkgCache.set(pkgPath, pkg.packageJson)
    return pkg.packageJson
  }

  fetchViteModule(id: string) {
    return this.vitenode.fetchModule(id)
  }

  resolveViteId(id: string, importer?: string) {
    return this.vitenode.resolveId(id, importer)
  }
}
