import { fileURLToPath } from 'url'
// eslint-disable-next-line no-restricted-imports
import { resolve } from 'path'
import { builtinModules } from 'module'
import { polyfillPath } from 'modern-node-polyfills'
import sirv from 'sirv'
import type { Plugin } from 'vite'

const polyfills = [
  'util',
]

export default (base = '/'): Plugin[] => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
  const distRoot = resolve(pkgRoot, 'dist')

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
      async resolveId(id) {
        if (id === '/__vitest_index__')
          return this.resolve('vitest/browser')

        if (id === '/__vitest_runners__')
          return this.resolve('vitest/runners')

        if (id.startsWith('node:'))
          id = id.slice(5)

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
      async resolveId(id) {
        if (!builtinModules.includes(id))
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
