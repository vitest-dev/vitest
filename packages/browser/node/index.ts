import { fileURLToPath } from 'url'
import nodePolyfills from 'rollup-plugin-node-polyfills'
import { join, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'

const nodeConfig = nodePolyfills({ fs: true, crypto: true })

export default (base = '/') => {
  return <Plugin>{
    enforce: 'pre',
    name: 'vitest:web',
    resolveId(id, importer) {
      id = normalizeId(id)

      if (id === 'vitest')
        return '/vitest.js'

      if (id === 'tty')
        return nodeConfig.resolveId(normalizeId(id), importer!)

      if (id === 'crypto')
        return nodeConfig.resolveId(normalizeId(id), importer!)

      if (id === 'path')
        return nodeConfig.resolveId(normalizeId(id), importer!)

      if (id === 'module')
        return join(fileURLToPath(import.meta.url), '..', './module.js')

      if (id === 'perf_hooks')
        return join(fileURLToPath(import.meta.url), '..', './perf_hooks.js')

      if (id === 'fs')
        return join(fileURLToPath(import.meta.url), '..', './fs-stub.js')

      return null
    },
    async configureServer(server) {
      const clientDist = resolve(fileURLToPath(import.meta.url), '..')
      server.middlewares.use(
        base,
        sirv(clientDist, {
          single: true,
          dev: true,
        }),
      )
    },
  }
}

function normalizeId(id: string, base?: string): string {
  if (base && id.startsWith(base))
    id = `/${id.slice(base.length)}`

  return id
    .replace(/^\/@id\/__x00__/, '\0') // virtual modules start with `\0`
    .replace(/^\/@id\//, '')
    .replace(/^__vite-browser-external:/, '')
    .replace(/^node:/, '')
    .replace(/[?&]v=\w+/, '?') // remove ?v= query
    .replace(/\?$/, '') // remove end query mark
}
