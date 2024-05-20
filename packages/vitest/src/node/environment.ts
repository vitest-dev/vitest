import type { TransformResult } from 'vite'
import { DevEnvironment, moduleRunnerTransform } from 'vite'
import { normalizeModuleId, toFilePath, withTrailingSlash } from 'vite-node/utils'
import { resolve } from 'pathe'
import { shouldExternalize } from 'vite-node/server'
import { withInlineSourcemap } from 'vite-node/source-map'
import type { FetchResult } from 'vite-node'

export class VitestDevEnvironemnt extends DevEnvironment {
  public readonly fetchCache = new Map<string, FetchCache>()

  #fetchPromiseCache = new Map<string, Promise<FetchResult>>()
  #externalizeCache = new Map<string, Promise<string | false> | string | false>()

  // TODO: is transformRequest cached? it was before

  resolveId(id: string, importer?: string) {
    if (importer && !importer.startsWith(withTrailingSlash(this.config.root)))
      importer = resolve(this.config.root, importer)
    return this.pluginContainer.resolveId(id, importer)
  }

  processModule(id: string) {
    const moduleId = normalizeModuleId(id)
    const promiseMap = this.#fetchPromiseCache
    // reuse transform for concurrent requests
    if (!promiseMap.has(moduleId)) {
      promiseMap.set(moduleId, this.#fetchModule(moduleId)
        .finally(() => {
          promiseMap.delete(moduleId)
        }))
    }
    return promiseMap.get(moduleId)!
  }

  async transformModule(id: string) {
    const normalizedId = normalizeModuleId(id)
    const mod = this.moduleGraph.getModuleById(normalizedId)
    // TODO: shouldn't use ssrTransform here
    const result = mod?.transformResult || await this.#transformRequest(
      normalizedId,
      mod?.file || normalizedId,
    )
    if (!result)
      return undefined
    return {
      code: result?.code,
      map: result?.map,
    }
  }

  async #fetchModule(id: string) {
    let result: FetchResult

    // const cacheDir = this.options.deps?.cacheDir
    // if (cacheDir && id.includes(cacheDir)) {
    //   if (!id.startsWith(withTrailingSlash(this.server.config.root)))
    //     id = join(this.server.config.root, id)
    //   const timeout = setTimeout(() => {
    //     throw new Error(`ViteNodeServer: ${id} not found. This is a bug, please report it.`)
    //   }, 5000) // CI can be quite slow
    //   await this.ensureExists(id)
    //   clearTimeout(timeout)
    // }

    const { path: filePath } = toFilePath(id, this.config.root)

    const moduleNode = this.#getUpdatedModule(id, filePath)
    const cache = this.fetchCache.get(filePath)

    // lastUpdateTimestamp is the timestamp that marks the last time the module was changed
    // if lastUpdateTimestamp is 0, then the module was not changed since the server started
    // we test "timestamp === 0" for expressiveness, but it's not necessary
    const timestamp = moduleNode
      ? Math.max(moduleNode.lastHMRTimestamp, moduleNode.lastInvalidationTimestamp)
      : 0
    if (cache && (timestamp === 0 || cache.timestamp >= timestamp))
      return cache.result

    const time = Date.now()
    const externalize = await this.shouldExternalize(filePath)
    let duration: number | undefined
    if (externalize) {
      result = { externalize }
      // this.debugger?.recordExternalize(id, externalize)
    }
    else {
      const start = performance.now()
      const r = await this.#transformRequest(id, filePath)
      duration = performance.now() - start
      result = { code: r?.code, map: r?.map as any }
    }

    const cacheEntry = {
      duration,
      timestamp: time,
      result,
    }

    this.fetchCache.set(filePath, cacheEntry)

    return result
  }

  async #transformRequest(id: string, filepath: string) {
    let result: TransformResult | null = null

    result = await this.transformRequest(id)

    if (result && !result.ssr) {
      result = await moduleRunnerTransform(
        result.code,
        result.map,
        id,
        result.code,
        this.config,
      )
    }

    const sourcemap = 'inline'
    // const sourcemap = this.options.sourcemap ?? 'inline'
    if (sourcemap === 'inline' && result && !id.includes('node_modules')) {
      result = withInlineSourcemap(result, {
        filepath,
        root: this.config.root,
      })
    }

    // if (this.options.debug?.dumpModules)
    //   await this.debugger?.dumpFile(id, result)

    return result
  }

  shouldExternalize(id: string) {
    return shouldExternalize(
      id,
      // TODO...
      this.config.test!.deps,
      this.#externalizeCache,
    )
  }

  public getTotalDuration() {
    const cache = [...this.fetchCache.values()].map(c => c.duration || 0)
    return cache.flat().reduce((a, b) => a + b, 0)
  }

  #getUpdatedModule(
    id: string,
    file: string,
  ) {
    const module = this.moduleGraph.getModuleById(id) || this.moduleGraph.getModuleById(file)
    if (module)
      return module
    const _modules = this.moduleGraph.getModulesByFile(file)
    if (!_modules || !_modules.size)
      return null
    // find the latest changed module
    const modules = [..._modules]
    let mod = modules[0]
    let latestMax = -1
    for (const m of _modules) {
      const timestamp = Math.max(m.lastHMRTimestamp, m.lastInvalidationTimestamp)
      if (timestamp > latestMax) {
        latestMax = timestamp
        mod = m
      }
    }
    return mod
  }
}

interface FetchCache {
  duration?: number
  timestamp: number
  result: FetchResult
}
