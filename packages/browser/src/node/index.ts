import { fileURLToPath } from 'node:url'

import { resolve } from 'node:path'
import { builtinModules } from 'node:module'
import { polyfillPath } from 'modern-node-polyfills'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { injectVitestModule } from './esmInjector'

const polyfills = [
  'util',
]

// don't expose type to not bundle it here
export default (project: any, base = '/'): Plugin[] => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
  const distRoot = resolve(pkgRoot, 'dist')

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
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
            exclude: [
              ...polyfills,
              ...builtinModules,
              'vitest',
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
              '@vitest/utils',
            ],
            include: [
              'vitest > diff-sequences',
              'vitest > loupe',
              'vitest > pretty-format',
              'vitest > pretty-format > ansi-styles',
              'vitest > pretty-format > ansi-regex',
              'vitest > chai',
            ],
          },
        }
      },
      async resolveId(id) {
        if (!builtinModules.includes(id) && !polyfills.includes(id) && !id.startsWith('node:')) {
          if (!/\?browserv=\w+$/.test(id))
            return

          let useId = id.slice(0, id.lastIndexOf('?'))
          if (useId.startsWith('/@fs/'))
            useId = useId.slice(5)

          if (/^\w:/.test(useId))
            useId = useId.replace(/\\/g, '/')

          return useId
        }

        id = normalizeId(id)
        return { id: await polyfillPath(id), moduleSideEffects: false }
      },
    },
    {
      name: 'vitest:browser:esm-injector',
      enforce: 'post',
      transform(source, id) {
        const hijackESM = project.config.browser.slowHijackESM ?? false
        if (!hijackESM)
          return
        return injectVitestModule(source, id, this.parse)
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
