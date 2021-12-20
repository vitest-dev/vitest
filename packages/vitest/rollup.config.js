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

const entry = [
  'src/index.ts',
  'src/node/cli.ts',
  'src/node.ts',
  'src/runtime/worker.ts',
  'src/runtime/entry.ts',
  'src/utils.ts',
]

const external = [
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'worker_threads',
]

export default ({ watch }) => [
  {
    input: entry,
    output: {
      dir: 'dist',
      format: 'esm',
    },
    external,
    plugins: [
      alias({
        entries: [
          { find: /^node:(.+)$/, replacement: '$1' },
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
      !watch && licensePlugin(),
    ],
    onwarn(message) {
      if (/Circular dependencies/.test(message))
        return
      console.error(message)
    },
  },
  {
    input: [
      'src/index.ts',
    ],
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts(),
    ],
  },
  {
    input: [
      'src/node.ts',
    ],
    output: {
      file: 'dist/node.d.ts',
      format: 'esm',
    },
    external,
    plugins: [
      dts(),
    ],
  },
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
