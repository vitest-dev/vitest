import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { basename, join, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin, ViteDevServer } from 'vite'
import type { ResolvedConfig } from 'vitest'
import type { BrowserScript, WorkspaceProject } from 'vitest/node'
import { coverageConfigDefaults } from 'vitest/config'
import { slash } from '@vitest/utils'
import { injectVitestModule } from './esmInjector'

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
        const testerPrefix = `${base}__vitest_test__/__test__/`
        server.middlewares.use((_req, res, next) => {
          const headers = server.config.server.headers
          if (headers) {
            for (const name in headers)
              res.setHeader(name, headers[name]!)
          }
          next()
        })
        let indexScripts: string | undefined
        let testerScripts: string | undefined
        server.middlewares.use(async (req, res, next) => {
          if (!req.url)
            return next()
          const url = new URL(req.url, 'http://localhost')
          if (!url.pathname.startsWith(testerPrefix) && url.pathname !== base)
            return next()

          res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate')
          res.setHeader('Content-Type', 'text/html; charset=utf-8')

          const files = project.browserState?.files ?? []

          const config = wrapConfig(project.getSerializableConfig())
          config.env ??= {}
          config.env.VITEST_BROWSER_DEBUG = process.env.VITEST_BROWSER_DEBUG || ''

          const injector = replacer(await injectorJs, {
            __VITEST_CONFIG__: JSON.stringify(config),
            __VITEST_FILES__: JSON.stringify(files),
            __VITEST_API_TOKEN__: JSON.stringify(project.ctx.config.api.token),
          })

          if (url.pathname === base) {
            if (!indexScripts)
              indexScripts = await formatScripts(project.config.browser.indexScripts, server)

            const html = replacer(await runnerHtml, {
              __VITEST_FAVICON__: favicon,
              __VITEST_TITLE__: 'Vitest Browser Runner',
              __VITEST_SCRIPTS__: indexScripts,
              __VITEST_INJECTOR__: injector,
            })
            res.write(html, 'utf-8')
            res.end()
            return
          }

          const decodedTestFile = decodeURIComponent(url.pathname.slice(testerPrefix.length))
          // if decoded test file is "__vitest_all__" or not in the list of known files, run all tests
          const tests = decodedTestFile === '__vitest_all__' || !files.includes(decodedTestFile) ? '__vitest_browser_runner__.files' : JSON.stringify([decodedTestFile])

          if (!testerScripts)
            testerScripts = await formatScripts(project.config.browser.testerScripts, server)

          const html = replacer(await testerHtml, {
            __VITEST_FAVICON__: favicon,
            __VITEST_TITLE__: 'Vitest Browser Tester',
            __VITEST_SCRIPTS__: testerScripts,
            __VITEST_INJECTOR__: injector,
            __VITEST_APPEND__:
            // TODO: have only a single global variable to not pollute the global scope
`<script type="module">
  __vitest_browser_runner__.runningFiles = ${tests}
  __vitest_browser_runner__.runTests(__vitest_browser_runner__.runningFiles)
</script>`,
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
              'vitest',
              'vitest/utils',
              'vitest/browser',
              'vitest/runners',
              '@vitest/utils',
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
              'vitest > @vitest/snapshot > magic-string',
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

function replacer(code: string, values: Record<string, string>) {
  return code.replace(/{\s*(\w+)\s*}/g, (_, key) => values[key] ?? '')
}

async function formatScripts(scripts: BrowserScript[] | undefined, server: ViteDevServer) {
  if (!scripts?.length)
    return ''
  const promises = scripts.map(async ({ content, src, async, id, type = 'module' }, index) => {
    const srcLink = (src ? (await server.pluginContainer.resolveId(src))?.id : undefined) || src
    const transformId = srcLink || join(server.config.root, `virtual__${id || `injected-${index}.js`}`)
    await server.moduleGraph.ensureEntryFromUrl(transformId)
    const contentProcessed = content && type === 'module'
      ? (await server.pluginContainer.transform(content, transformId)).code
      : content
    return `<script type="${type}"${async ? ' async' : ''}${srcLink ? ` src="${slash(`/@fs/${srcLink}`)}"` : ''}>${contentProcessed || ''}</script>`
  })
  return (await Promise.all(promises)).join('\n')
}
