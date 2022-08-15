import fs from 'fs'
import { builtinModules } from 'module'
import { dirname, join, relative, resolve } from 'pathe'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import nodeResolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import license from 'rollup-plugin-license'
import c from 'picocolors'
import fg from 'fast-glob'
import { defineConfig } from 'rollup'

import pkg from './package.json'

const entries = [
  'src/index.ts',
  'src/browser.ts',
  'src/node/cli.ts',
  'src/node.ts',
  'src/runtime/worker.ts',
  'src/runtime/loader.ts',
  'src/runtime/entry.ts',
  'src/runtime/suite.ts',
  'src/integrations/spy.ts',
]

const dtsEntries = [
  'src/index.ts',
  'src/node.ts',
  'src/browser.ts',
  'src/config.ts',
]

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'worker_threads',
  'inspector',
]

const plugins = [
  alias({
    entries: [
      { find: /^node:(.+)$/, replacement: '$1' },
      { find: 'vite-node/server', replacement: resolve(__dirname, '../vite-node/src/server.ts') },
      { find: 'vite-node/client', replacement: resolve(__dirname, '../vite-node/src/client.ts') },
      { find: 'vite-node/utils', replacement: resolve(__dirname, '../vite-node/src/utils.ts') },
    ],
  }),
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
    output: {
      dir: 'dist',
      format: 'esm',
      entryFileNames: '[name].mjs',
      chunkFileNames: (chunkInfo) => {
        const id = chunkInfo.facadeModuleId || Object.keys(chunkInfo.modules).find(i => !i.includes('node_modules') && i.includes('src/'))
        if (id) {
          const parts = Array.from(
            new Set(relative(process.cwd(), id).split(/\//g)
              .map(i => i.replace(/\..*$/, ''))
              .filter(i => !['src', 'index', 'dist', 'node_modules'].some(j => i.includes(j)) && i.match(/^[\w_-]+$/))),
          )
          if (parts.length)
            return `chunk-${parts.slice(-2).join('-')}.[hash].mjs`
        }
        return 'vendor-[name].[hash].mjs'
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
        file: 'dist/config.mjs',
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
      entryFileNames: chunk => `${chunk.name.replace('src/', '')}.d.ts`,
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
        resolve(__dirname, '../../LICENSE'),
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
        .sort(({ name: nameA }, { name: nameB }) =>
          nameA > nameB ? 1 : nameB > nameA ? -1 : 0,
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
                    .map(line => `> ${line}`)
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
