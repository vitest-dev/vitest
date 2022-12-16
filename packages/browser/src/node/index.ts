import { fileURLToPath } from 'url'
// eslint-disable-next-line no-restricted-imports
import { resolve } from 'path'
import { builtinModules } from 'module'
import { polyfillPath } from 'modern-node-polyfills'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { resolvePath } from 'mlly'

const stubs = [
  'fs',
  'local-pkg',
  'module',
  'noop',
  'perf_hooks',
  'console',
]

const polyfills = [
  'util',
  'tty',
  'process',
  'path',
  'buffer',
]

export default (base = '/'): Plugin[] => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
  const distRoot = resolve(pkgRoot, 'dist')

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
      async resolveId(id, _, ctx) {
        if (ctx.ssr)
          return

        if (id === '/__vitest_index__') {
          const result = await resolvePath('vitest/browser')
          return result
        }

        if (stubs.includes(id))
          return resolve(pkgRoot, 'stubs', id)

        if (polyfills.includes(id))
          return polyfillPath(normalizeId(id))

        return null
      },
      async configureServer(server) {
        server.middlewares.use(
          base,
          sirv(resolve(distRoot, 'client'), {
            single: false,
            dev: true,
          }),
        )
      },
    },
    {
      name: 'modern-node-polyfills',
      async resolveId(id, _, ctx) {
        if (ctx.ssr || !builtinModules.includes(id))
          return

        id = normalizeId(id)
        return { id: await polyfillPath(id), moduleSideEffects: false }
      },
    },
  ]
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
