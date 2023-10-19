import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { builtinModules } from 'node:module'
import { readFile } from 'node:fs/promises'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import { injectVitestModule } from './esmInjector'

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
        const esmClientInjectorPromise = readFile(resolve(distRoot, 'client/esm-client-injector.js'), 'utf-8')
        server.middlewares.use(async (req, res, next) => {
          const match = req.url?.match(testMatcher)
          if (match) {
            const [testerHtml, esmClientInjector] = await Promise.all([
              testerHtmlPromise,
              esmClientInjectorPromise,
            ])
            const [, test, version] = match

            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.write(
              testerHtml.replace(
                'href="favicon.svg"', `href="${base}/favicon.svg"`.replace('//', '/'),
              ).replace(
                '</title>', ` - ${test}</title>`,
              ).replace(
                '<script src="esm-client-injector.js"></script>', `<script>
${esmClientInjector}
</script>`,
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
      name: 'vitest:browser:tests',
      enforce: 'pre',
      config() {
        return {
          optimizeDeps: {
            exclude: [
              ...builtinModules,
              'vitest',
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
              '@vitest/utils',
            ],
            include: [
              'vitest > @vitest/utils > pretty-format',
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
        if (!/\?browserv=\w+$/.test(id))
          return

        let useId = id.slice(0, id.lastIndexOf('?'))
        if (useId.startsWith('/@fs/'))
          useId = useId.slice(5)

        if (/^\w:/.test(useId))
          useId = useId.replace(/\\/g, '/')

        return useId
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
