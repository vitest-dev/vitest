import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { builtinModules } from 'node:module'
import { readFile } from 'node:fs/promises'
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
        const prefix = `${base}/__vitest_test__/`.replace('//', '/')
        const testMatcher = new RegExp(`^${prefix}(.*)\\.html\\?browserv=(\\w+)$`)
        const testerHtmlPromise = readFile(resolve(distRoot, 'client/tester.html'), 'utf-8')
        server.middlewares.use(async (req, res, next) => {
          const match = req.url?.match(testMatcher)
          if (match) {
            const testerHtml = await testerHtmlPromise
            const [, test, version] = match

            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.write(
              testerHtml.replace(
                'href="favicon.svg"', `href="${base}/favicon.svg"`.replace('//', '/'),
              ).replace(
                '</title>', ` - ${test}</title>`,
              ).replace(
                '</body>', `<script type="module">
await __vitest_browser_runner__.runTest('${test}', '${version}');
</script></body>`,
              ),
              'utf-8',
            )
            res.end()
          }
          else {
            next()
          }
        })
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
              '@vitest/utils > concordance',
              '@vitest/utils > loupe',
              '@vitest/utils > pretty-format',
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
        return injectVitestModule(source, id, this.parse, {
          cacheDir: project.server.config.cacheDir,
        })
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
