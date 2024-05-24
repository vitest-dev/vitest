import { existsSync } from 'node:fs'
import type { DevEnvironment, TransformResult } from 'vite'
import { moduleRunnerTransform } from 'vite'
import { join, normalize, relative, resolve } from 'pathe'
import { normalizeModuleId, toArray, toFilePath, withTrailingSlash } from './utils'
import { shouldExternalize } from './server'
import { withInlineSourcemap } from './source-map'
import type { FetchResult, ViteNodeServerOptions } from './types'
import { Debugger } from './debug'

export class ViteNodeProcessor {
  public readonly fetchCache = new Map<string, FetchCache>()

  private readonly fetchPromiseCache = new Map<string, Promise<FetchResult>>()
  private readonly transformPromiseCache = new Map<string, Promise<TransformResult | undefined>>()
  private readonly externalizeCache = new Map<string, Promise<string | false> | string | false>()
  private readonly existingOptimizedDeps = new Set<string>()
  private readonly debugger?: Debugger

  constructor(
    public readonly environment: DevEnvironment,
    private readonly options: ViteNodeServerOptions = {},
  ) {
    const config = environment.config

    options.deps ??= {}
    options.deps.cacheDir = relative(config.root, options.deps.cacheDir || config.cacheDir)

    const noExternal = config.ssr.noExternal ?? environment.options.resolve.noExternal

    // we don't externalize ssr, because it has different semantics in Vite
    // if (ssrOptions.external) {
    //   options.deps.external ??= []
    //   options.deps.external.push(...ssrOptions.external)
    // }

    if (noExternal === true) {
      options.deps.inline ??= true
    }
    else if (options.deps.inline !== true) {
      options.deps.inline ??= []
      const inline = options.deps.inline
      options.deps.inline.push(...toArray(noExternal).filter(dep => !inline.includes(dep)))
    }
    // if (process.env.VITE_NODE_DEBUG_DUMP) {
    //   options.debug = Object.assign(<DebuggerOptions>{
    //     dumpModules: !!process.env.VITE_NODE_DEBUG_DUMP,
    //     loadDumppedModules: process.env.VITE_NODE_DEBUG_DUMP === 'load',
    //   }, options.debug ?? {})
    // }
    if (options.debug)
      this.debugger = new Debugger(environment.config.root, options.debug!)

    options.deps.moduleDirectories ??= []

    const envValue = process.env.VITE_NODE_DEPS_MODULE_DIRECTORIES || process.env.npm_config_VITE_NODE_DEPS_MODULE_DIRECTORIES
    const customModuleDirectories = envValue?.split(',')
    if (customModuleDirectories)
      options.deps.moduleDirectories.push(...customModuleDirectories)

    options.deps.moduleDirectories = options.deps.moduleDirectories.map((dir) => {
      if (dir[0] !== '/')
        dir = `/${dir}`
      if (!dir.endsWith('/'))
        dir += '/'
      return normalize(dir)
    })

    // always add node_modules as a module directory
    if (!options.deps.moduleDirectories.includes('/node_modules/'))
      options.deps.moduleDirectories.push('/node_modules/')
  }

  public shouldExternalize(id: string) {
    return shouldExternalize(
      id,
      this.options.deps,
      this.externalizeCache,
    )
  }

  public getTotalDuration() {
    const cache = [...this.fetchCache.values()].map(c => c.duration || 0)
    return cache.flat().reduce((a, b) => a + b, 0)
  }

  public resolveId(id: string, importer?: string) {
    const config = this.environment.config
    if (importer && !importer.startsWith(withTrailingSlash(config.root)))
      importer = resolve(config.root, importer)
    return this.environment.pluginContainer.resolveId(id, importer)
  }

  public fetchModule(id: string) {
    const moduleId = normalizeModuleId(id)
    const promiseMap = this.fetchPromiseCache
    // reuse transform for concurrent requests
    if (!promiseMap.has(moduleId)) {
      promiseMap.set(moduleId, this._fetchModule(moduleId)
        .finally(() => {
          promiseMap.delete(moduleId)
        }))
    }
    return promiseMap.get(moduleId)!
  }

  public transformRequest(id: string) {
    const moduleId = normalizeModuleId(id)
    const promiseMap = this.transformPromiseCache
    // reuse transform for concurrent requests
    if (!promiseMap.has(moduleId)) {
      promiseMap.set(moduleId, this._transformRequest(moduleId)
        .finally(() => {
          promiseMap.delete(moduleId)
        }))
    }
    return promiseMap.get(moduleId)!
  }

  private async _fetchModule(id: string) {
    const cacheDir = this.options.deps?.cacheDir
    if (cacheDir && id.includes(cacheDir)) {
      if (!id.startsWith(withTrailingSlash(this.environment.config.root)))
        id = join(this.environment.config.root, id)
      const timeout = setTimeout(() => {
        throw new Error(`ViteNodeProcessor: ${id} not found. This is a bug, please report it.`)
      }, 5000) // CI can be quite slow
      await this.ensureExists(id)
      clearTimeout(timeout)
    }

    const { path: filename } = toFilePath(id, this.environment.config.root)

    const moduleNode = this._getUpdatedModule(id, filename)
    const cache = this.fetchCache.get(filename)

    // lastUpdateTimestamp is the timestamp that marks the last time the module was changed
    // if lastUpdateTimestamp is 0, then the module was not changed since the server started
    // we test "timestamp === 0" for expressiveness, but it's not necessary
    const timestamp = moduleNode
      ? Math.max(moduleNode.lastHMRTimestamp, moduleNode.lastInvalidationTimestamp)
      : 0
    if (cache && (timestamp === 0 || cache.timestamp >= timestamp))
      return cache.result

    let result: FetchResult
    const time = Date.now()
    const externalize = await this.shouldExternalize(filename)
    let duration: number | undefined
    if (externalize) {
      result = { externalize }
      this.debugger?.recordExternalize(id, externalize)
    }
    else {
      const start = performance.now()
      const r = await this._transformRequest(id)
      duration = performance.now() - start
      if (!r)
        throw new Error(`Failed to fetch module ${id}`)
      result = r
    }

    const cacheEntry = {
      duration,
      timestamp: time,
      result,
    }

    this.fetchCache.set(filename, cacheEntry)

    return result
  }

  private async _transformRequest(id: string) {
    if (this.options.debug?.loadDumppedModules) {
      const result = await this.debugger?.loadDump(id) ?? undefined
      if (result)
        return result
    }

    let result = await this.environment.transformRequest(id)

    if (result && !result.ssr) {
      result = await moduleRunnerTransform(
        result.code,
        result.map,
        id,
        result.code,
        this.environment.config,
      )
    }

    const sourcemap = this.options.sourcemap ?? 'inline'
    if (sourcemap === 'inline' && result && !id.includes('node_modules')) {
      const mod = this.environment.moduleGraph.getModuleById(id)
      result = withInlineSourcemap(result, {
        filepath: mod?.file || id,
        root: this.environment.config.root,
      })
    }

    if (this.options.debug?.dumpModules)
      await this.debugger?.dumpFile(id, result)

    return result || undefined
  }

  private _getUpdatedModule(
    id: string,
    file: string,
  ) {
    const moduleGraph = this.environment.moduleGraph
    const module = moduleGraph.getModuleById(id) || moduleGraph.getModuleById(file)
    if (module)
      return module
    const _modules = moduleGraph.getModulesByFile(file)
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

  private async ensureExists(id: string): Promise<boolean> {
    if (this.existingOptimizedDeps.has(id))
      return true
    if (existsSync(id)) {
      this.existingOptimizedDeps.add(id)
      return true
    }
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        this.ensureExists(id).then(() => {
          resolve(true)
        })
      })
    })
  }
}

interface FetchCache {
  duration?: number
  timestamp: number
  result: FetchResult
}
