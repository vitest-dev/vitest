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
      async resolveId(id, importer, options) {
        if (id.includes('?'))
          // Work-around for vite:resolve. The "import('./file.mjs?v=123')" fails to load "./file.mts" and throws error.
          return this.resolve(id.split('?')[0], importer, options)
      },
      async config(viteConfig) {
        // Enables using ignore hint for coverage providers with @preserve keyword
        viteConfig.esbuild ||= {}
        viteConfig.esbuild.legalComments = 'inline'
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
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            exclude: [...polyfills, ...builtinModules],
          },
        }
      },
      async resolveId(id) {
        if (!builtinModules.includes(id) && !polyfills.includes(id) && !id.startsWith('node:'))
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
