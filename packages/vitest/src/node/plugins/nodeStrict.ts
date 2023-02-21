import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { moduleResolve as resolveImport } from 'import-meta-resolve'
import { normalize } from 'pathe'
import { normalizeModuleId } from 'vite-node/utils'
import type { Vitest } from '../core'

export const NodeStrictPlugin = (ctx: Vitest): Plugin => {
  return {
    name: 'vitest:node-strict',
    enforce: 'pre',
    configResolved(config) {
      // if (config.environment === 'node-strict') {
      // remove analyze plugin, so we don't have any static analysis, and resolve evey import at runtime
      // this allows us to give better error messages
      const analyzePlugin = config.plugins.findIndex(p => p.name === 'vite:import-analysis')
      config.plugins.splice(analyzePlugin, 1)
      // TODO: should probably just provide "custom" options from import analysis plugin, because it does a lot of stuff like pretransform
      // }
    },
    resolveId(path, importer) {
      if (ctx.config.environment !== 'node-strict')
        return null

      if (path.startsWith('/')) {
        const resolved = path.startsWith(ctx.server.config.root)
          ? path
          : join(ctx.server.config.root, path)
        if (existsSync(resolved))
          return { id: resolved }
      }

      path = normalizeModuleId(path)
      importer = normalizeModuleId(importer && !importer.endsWith('.html')
        ? importer
        : ctx.server.config.root,
      )
      const importerURL = pathToFileURL(importer)
      const originalPath = path
      const preserveSymlinks = ctx.server.config.resolve.preserveSymlinks
      const conditions = new Set(['node', 'import', ...ctx.server.config.resolve.conditions])
      const resolver = (path: string) => {
        return resolveImport(path, importerURL, conditions, preserveSymlinks).href
      }
      // TS has a weird algorithm for resolving imports, and it requires js
      // but the file is probably .ts. if not, we try again with the original path
      if (importer.endsWith('.ts'))
        path = path.replace(/\.(c|m)?js$/, '.$1ts')
      let id: string
      try {
        id = resolver(path)
      }
      catch (err: any) {
        if (err.code !== 'ERR_MODULE_NOT_FOUND' && err.code !== 'MODULE_NOT_FOUND')
          throw err
        id = resolver(originalPath)
      }
      if (id.startsWith('file://'))
        id = fileURLToPath(id)
      return normalize(id)
    },
  }
}
