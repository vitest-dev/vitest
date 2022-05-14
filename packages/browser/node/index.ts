import { fileURLToPath } from 'url'
// eslint-disable-next-line no-restricted-imports
import { resolve } from 'path'
import nodePolyfills from 'rollup-plugin-polyfill-node'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { resolvePath } from 'mlly'

const stubsNames = [
  'fs',
  'local-pkg',
  'module',
  'noop',
  'perf_hooks',
  'tty',
]

export default (base = '/'): Plugin[] => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
  const distRoot = resolve(pkgRoot, 'dist')

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
      async resolveId(id, imp, ctx) {
        if (ctx.ssr)
          return

        if (id === '/__vitest_index__') {
          const result = await resolvePath('vitest/browser')
          return result
        }

        if (stubsNames.includes(id))
          return resolve(pkgRoot, 'stubs', id)

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
    nodePolyfills({
      include: null,
    }),
  ]
}
