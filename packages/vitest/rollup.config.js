import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize, relative, resolve } from 'pathe'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import license from 'rollup-plugin-license'
import c from 'picocolors'
import fg from 'fast-glob'
import { defineConfig } from 'rollup'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  'path': 'src/paths.ts',
  'index': 'src/index.ts',
  'cli': 'src/node/cli.ts',
  'cli-wrapper': 'src/node/cli/cli-wrapper.ts',
  'node': 'src/node.ts',
  'suite': 'src/suite.ts',
  'browser': 'src/browser.ts',
  'runners': 'src/runners.ts',
  'environments': 'src/environments.ts',
  'spy': 'src/integrations/spy.ts',
  'coverage': 'src/coverage.ts',
  'utils': 'src/public/utils.ts',
  'execute': 'src/public/execute.ts',
  'reporters': 'src/public/reporters.ts',
  // TODO: advanced docs
  'workers': 'src/workers.ts',

  // for performance reasons we bundle them separately so we don't import everything at once
  'worker': 'src/runtime/worker.ts',
  'workers/forks': 'src/runtime/workers/forks.ts',
  'workers/threads': 'src/runtime/workers/threads.ts',
  'workers/vmThreads': 'src/runtime/workers/vmThreads.ts',
  'workers/vmForks': 'src/runtime/workers/vmForks.ts',

  'workers/runVmTests': 'src/runtime/runVmTests.ts',

  'snapshot': 'src/snapshot.ts',
}

const dtsEntries = {
  index: 'src/index.ts',
  node: 'src/node.ts',
  environments: 'src/environments.ts',
  browser: 'src/browser.ts',
  runners: 'src/runners.ts',
  suite: 'src/suite.ts',
  config: 'src/config.ts',
  coverage: 'src/coverage.ts',
  utils: 'src/public/utils.ts',
  execute: 'src/public/execute.ts',
  reporters: 'src/public/reporters.ts',
  workers: 'src/workers.ts',
  snapshot: 'src/snapshot.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'worker_threads',
  'node:worker_threads',
  'node:fs',
  'node:stream',
  'node:vm',
  'node:http',
  'inspector',
  'vite-node/source-map',
  'vite-node/client',
  'vite-node/server',
  'vite-node/constants',
  'vite-node/utils',
  '@vitest/utils/diff',
  '@vitest/utils/ast',
  '@vitest/utils/error',
  '@vitest/utils/source-map',
  '@vitest/runner/utils',
  '@vitest/runner/types',
  '@vitest/snapshot/environment',
  '@vitest/snapshot/manager',
]

const dir = dirname(fileURLToPath(import.meta.url))

const plugins = [
  nodeResolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  esbuild({
    target: 'node14',
  }),
]

export default ({ watch }) => defineConfig([
  {
    input: entries,
    treeshake: true,
    output: {
      dir: 'dist',
      format: 'esm',
      chunkFileNames: (chunkInfo) => {
        let id = chunkInfo.facadeModuleId || Object.keys(chunkInfo.moduleIds).find(i => !i.includes('node_modules') && (i.includes('src/') || i.includes('src\\')))
        if (id) {
          id = normalize(id)
          const parts = Array.from(
            new Set(relative(process.cwd(), id).split(/\//g)
              .map(i => i.replace(/\..*$/, ''))
              .filter(i => !['src', 'index', 'dist', 'node_modules'].some(j => i.includes(j)) && i.match(/^[\w_-]+$/))),
          )
          if (parts.length)
            return `chunks/${parts.slice(-2).join('-')}.[hash].js`
        }
        return 'vendor/[name].[hash].js'
      },
    },
    external,
    plugins: [
      ...plugins,
      !watch && licensePlugin(),
    ],
    onwarn,
  },
  {
    input: 'src/config.ts',
    output: [
      {
        file: 'dist/config.cjs',
        format: 'cjs',
      },
      {
        file: 'dist/config.js',
        format: 'esm',
      },
    ],
    external,
    plugins,
  },
  {
    input: dtsEntries,
    output: {
      dir: 'dist',
      entryFileNames: chunk => `${normalize(chunk.name).replace('src/', '')}.d.ts`,
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
    ],
  },
])

function licensePlugin() {
  return license({
    thirdParty(dependencies) {
      // https://github.com/rollup/rollup/blob/master/build-plugins/generate-license-file.js
      // MIT Licensed https://github.com/rollup/rollup/blob/master/LICENSE-CORE.md
      const coreLicense = fs.readFileSync(
        resolve(dir, '../../LICENSE'),
      )
      function sortLicenses(licenses) {
        let withParenthesis = []
        let noParenthesis = []
        licenses.forEach((license) => {
          if (/^\(/.test(license))
            withParenthesis.push(license)

          else
            noParenthesis.push(license)
        })
        withParenthesis = withParenthesis.sort()
        noParenthesis = noParenthesis.sort()
        return [...noParenthesis, ...withParenthesis]
      }
      const licenses = new Set()
      const dependencyLicenseTexts = dependencies
        .filter(({ name }) => !name?.startsWith('@vitest/'))
        .sort(({ name: nameA }, { name: nameB }) => nameA > nameB ? 1 : nameB > nameA ? -1 : 0,
        )
        .map(
          ({
            name,
            license,
            licenseText,
            author,
            maintainers,
            contributors,
            repository,
          }) => {
            let text = `## ${name}\n`
            if (license)
              text += `License: ${license}\n`

            const names = new Set()
            if (author && author.name)
              names.add(author.name)

            for (const person of maintainers.concat(contributors)) {
              if (person && person.name)
                names.add(person.name)
            }
            if (names.size > 0)
              text += `By: ${Array.from(names).join(', ')}\n`

            if (repository)
              text += `Repository: ${repository.url || repository}\n`

            if (!licenseText) {
              try {
                const pkgDir = dirname(
                  resolve(join(name, 'package.json'), {
                    preserveSymlinks: false,
                  }),
                )
                const licenseFile = fg.sync(`${pkgDir}/LICENSE*`, {
                  caseSensitiveMatch: false,
                })[0]
                if (licenseFile)
                  licenseText = fs.readFileSync(licenseFile, 'utf-8')
              }
              catch {}
            }
            if (licenseText) {
              text
                += `\n${
                  licenseText
                    .trim()
                    .replace(/(\r\n|\r)/gm, '\n')
                    .split('\n')
                    .map(line => line ? `> ${line}` : '>')
                    .join('\n')
                }\n`
            }
            licenses.add(license)
            return text
          },
        )
        .join('\n---------------------------------------\n\n')
      const licenseText
        = '# Vitest core license\n'
        + `Vitest is released under the MIT license:\n\n${
          coreLicense
        }\n# Licenses of bundled dependencies\n`
        + 'The published Vitest artifact additionally contains code with the following licenses:\n'
        + `${sortLicenses(licenses).join(', ')}\n\n`
        + `# Bundled dependencies:\n${
          dependencyLicenseTexts}`
      const existingLicenseText = fs.readFileSync('LICENSE.md', 'utf8')
      if (existingLicenseText !== licenseText) {
        fs.writeFileSync('LICENSE.md', licenseText)
        console.warn(
          c.yellow(
            '\nLICENSE.md updated. You should commit the updated file.\n',
          ),
        )
      }
    },
  })
}

function onwarn(message) {
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code))
    return
  console.error(message)
}
