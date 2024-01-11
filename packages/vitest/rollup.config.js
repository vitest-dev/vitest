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

const entries = [
  'src/paths.ts',
  'src/index.ts',
  'src/node/cli.ts',
  'src/node/cli-wrapper.ts',
  'src/node.ts',
  'src/suite.ts',
  'src/browser.ts',
  'src/runners.ts',
  'src/environments.ts',
  'src/runtime/worker.ts',
  'src/runtime/vm.ts',
  'src/runtime/child.ts',
  'src/runtime/entry.ts',
  'src/runtime/entry-vm.ts',
  'src/integrations/spy.ts',
  'src/coverage.ts',
  'src/public/utils.ts',
  'src/public/execute.ts',
  'src/public/reporters.ts',
]

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
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'worker_threads',
  'node:worker_threads',
  'node:fs',
  'node:vm',
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
