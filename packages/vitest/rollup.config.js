import fs from 'fs'
import path from 'pathe'
import esbuild from 'rollup-plugin-esbuild'
import dts from 'rollup-plugin-dts'
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import alias from '@rollup/plugin-alias'
import license from 'rollup-plugin-license'
import c from 'picocolors'
import fg from 'fast-glob'

import pkg from './package.json'

const entries = [
  'src/index.ts',
  'src/node/cli.ts',
  'src/node.ts',
  'src/runtime/worker.ts',
  'src/runtime/entry.ts',
  'src/integrations/jest-mock.ts',
]

const dtsEntries = [
  'src/index.ts',
  'src/node.ts',
  'src/config.ts',
]

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'worker_threads',
  'inspector',
  'c8',
]

const plugins = [
  alias({
    entries: [
      { find: /^node:(.+)$/, replacement: '$1' },
      { find: 'vite-node/server', replacement: path.resolve(__dirname, '../vite-node/src/server.ts') },
      { find: 'vite-node/client', replacement: path.resolve(__dirname, '../vite-node/src/client.ts') },
      { find: 'vite-node/utils', replacement: path.resolve(__dirname, '../vite-node/src/utils.ts') },
    ],
  }),
  resolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  esbuild({
    target: 'node14',
  }),
]

export default ({ watch }) => [
  {
    input: entries,
    output: {
      dir: 'dist',
      format: 'esm',
      sourcemap: 'inline',
    },
    external,
    plugins: [
      ...plugins,
      !watch && licensePlugin(),
    ],
    onwarn(message) {
      if (/Circular dependencies/.test(message))
        return
      console.error(message)
    },
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
  ...dtsEntries.map(input => ({
    input,
    output: {
      file: input.replace('src/', 'dist/').replace('.ts', '.d.ts'),
      format: 'esm',
    },
    external,
    plugins: [
      dts({ respectExternal: true }),
    ],
  })),
]

function licensePlugin() {
  return license({
    thirdParty(dependencies) {
      // https://github.com/rollup/rollup/blob/master/build-plugins/generate-license-file.js
      // MIT Licensed https://github.com/rollup/rollup/blob/master/LICENSE-CORE.md
      const coreLicense = fs.readFileSync(
        path.resolve(__dirname, '../../LICENSE'),
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
                const pkgDir = path.dirname(
                  resolve(path.join(name, 'package.json'), {
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
