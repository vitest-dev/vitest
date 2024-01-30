import { fileURLToPath } from 'node:url'

import { basename, resolve } from 'pathe'
import sirv from 'sirv'
import type { Plugin } from 'vite'
import type { WorkspaceProject } from 'vitest/node'
import { coverageConfigDefaults } from 'vitest/config'
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
        server.middlewares.use(
          base,
          sirv(resolve(distRoot, 'client'), {
            single: false,
            dev: true,
            setHeaders(res, _pathname, _stats) {
              const headers = server.config.server.headers
              if (headers) {
                for (const name in headers)
                  res.setHeader(name, headers[name]!)
              }
            },
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
