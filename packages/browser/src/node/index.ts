import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import type { ResolvedConfig } from 'vitest'
import type { WorkspaceProject } from 'vitest/node'
import { coverageConfigDefaults } from 'vitest/config'
import { injectVitestModule } from './esmInjector'

function replacer(code: string, values: Record<string, string>) {
  return code.replace(/{\s*(\w+)\s*}/g, (_, key) => values[key] ?? '')
}

export default (project: WorkspaceProject, base = '/'): Plugin[] => {
  const pkgRoot = resolve(fileURLToPath(import.meta.url), '../..')
  const distRoot = resolve(pkgRoot, 'dist')

  return [
    {
      enforce: 'pre',
      name: 'vitest:browser',
      async config(viteConfig) {
        // Enables using ignore hint for coverage providers with @preserve keyword
        if (viteConfig.esbuild !== false) {
          viteConfig.esbuild ||= {}
          viteConfig.esbuild.legalComments = 'inline'
        }
      },
      async configureServer(server) {
        const testerHtml = readFile(resolve(distRoot, 'client/tester.html'), 'utf8')
        const runnerHtml = readFile(resolve(distRoot, 'client/index.html'), 'utf8')
        const injectorJs = readFile(resolve(distRoot, 'client/esm-client-injector.js'), 'utf8')
        const favicon = `${base}favicon.svg`
        server.middlewares.use((_req, res, next) => {
          const headers = server.config.server.headers
          if (headers) {
            for (const name in headers)
              res.setHeader(name, headers[name]!)
          }
          next()
        })
        server.middlewares.use(async (req, res, next) => {
          if (!req.url)
            return next()
          const url = new URL(req.url, 'http://localhost')
          if (!url.pathname.endsWith('__vitest_test__/tester.html') && url.pathname !== base)
            return next()
          const id = url.searchParams.get('__vitest_id')

          // TODO: more handling, id is required
          if (!id) {
            res.statusCode = 404
            res.end()
            return
          }

          res.setHeader('Content-Type', 'text/html; charset=utf-8')

          const injector = replacer(await injectorJs, {
            __VITEST_CONFIG__: JSON.stringify(wrapConfig(project.getSerializableConfig())),
          })

          if (url.pathname === base) {
            const html = replacer(await runnerHtml, {
              __VITEST_FAVICON__: favicon,
              __VITEST_TITLE__: 'Vitest Browser Runner',
              __VITEST_INJECTOR__: injector,
            })
            res.write(html, 'utf-8')
            res.end()
            return
          }

          const testIndex = url.searchParams.get('__vitest_index')
          const data = project.ctx.state.browserTestMap.get(id)
          const test = testIndex && data?.paths[Number(testIndex)]
          if (!test) {
            res.statusCode = 404
            res.end()
            return
          }
          const html = replacer(await testerHtml, {
            __VITEST_FAVICON__: favicon,
            __VITEST_TITLE__: test,
            __VITEST_TEST__: test,
            __VITEST_INJECTOR__: injector,
            __VITEST_TESTER__: `<script type="module">await __vitest_browser_runner__.runTest("${test}", "${id}")</script>`,
          })
          res.write(html, 'utf-8')
          res.end()
        })
        server.middlewares.use(
          base,
          sirv(resolve(distRoot, 'client'), {
            single: false,
            dev: true,
          }),
        )

        const coverageFolder = resolveCoverageFolder(project)
        const coveragePath = coverageFolder ? coverageFolder[1] : undefined
        if (coveragePath && base === coveragePath)
          throw new Error(`The ui base path and the coverage path cannot be the same: ${base}, change coverage.reportsDirectory`)

        coverageFolder && server.middlewares.use(coveragePath!, sirv(coverageFolder[0], {
          single: true,
          dev: true,
          setHeaders: (res) => {
            res.setHeader('Cache-Control', 'public,max-age=0,must-revalidate')
          },
        }))
      },
    },
    {
      name: 'vitest:browser:tests',
      enforce: 'pre',
      async config() {
        const {
          include,
          exclude,
          includeSource,
          dir,
          root,
        } = project.config
        const projectRoot = dir || root
        const entries = await project.globAllTestFiles(include, exclude, includeSource, projectRoot)
        return {
          optimizeDeps: {
            entries: [
              ...entries,
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
            ],
            exclude: [
              'vitest',
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
              '@vitest/utils',

              // loupe is manually transformed
              'loupe',
            ],
            include: [
              'vitest > @vitest/utils > pretty-format',
              'vitest > @vitest/snapshot > pretty-format',
              'vitest > diff-sequences',
              'vitest > pretty-format',
              'vitest > pretty-format > ansi-styles',
              'vitest > pretty-format > ansi-regex',
              'vitest > chai',
            ],
          },
        }
      },
      transform(code, id) {
        if (id.includes('loupe/loupe.js')) {
          const exportsList = ['custom', 'inspect', 'registerConstructor', 'registerStringTag']
          const codeAppend = exportsList.map(i => `export const ${i} = globalThis.loupe.${i}`).join('\n')
          return `${code}\n${codeAppend}\nexport default globalThis.loupe`
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

function resolveCoverageFolder(project: WorkspaceProject) {
  const options = project.ctx.config
  const htmlReporter = options.coverage?.enabled
    ? options.coverage.reporter.find((reporter) => {
      if (typeof reporter === 'string')
        return reporter === 'html'

      return reporter[0] === 'html'
    })
    : undefined

  if (!htmlReporter)
    return undefined

  // reportsDirectory not resolved yet
  const root = resolve(
    options.root || options.root || process.cwd(),
    options.coverage.reportsDirectory || coverageConfigDefaults.reportsDirectory,
  )

  const subdir = (Array.isArray(htmlReporter) && htmlReporter.length > 1 && 'subdir' in htmlReporter[1])
    ? htmlReporter[1].subdir
    : undefined

  if (!subdir || typeof subdir !== 'string')
    return [root, `/${basename(root)}/`]

  return [resolve(root, subdir), `/${basename(root)}/${subdir}/`]
}

function wrapConfig(config: ResolvedConfig): ResolvedConfig {
  return {
    ...config,
    // workaround RegExp serialization
    testNamePattern:
      config.testNamePattern
        ? config.testNamePattern.toString() as any as RegExp
        : undefined,
  }
}
