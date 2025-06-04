import fs from 'node:fs'
import { builtinModules, createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import commonjs from '@rollup/plugin-commonjs'
import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'
import { dirname, join, normalize, resolve } from 'pathe'
import { defineConfig } from 'rollup'
import license from 'rollup-plugin-license'
import { globSync } from 'tinyglobby'
import c from 'tinyrainbow'
import oxc from 'unplugin-oxc/rollup'
import { createDtsUtils } from '../../scripts/build-utils.js'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')

const entries = {
  'path': 'src/paths.ts',
  'index': 'src/public/index.ts',
  'cli': 'src/node/cli.ts',
  'config': 'src/public/config.ts',
  'node': 'src/public/node.ts',
  'suite': 'src/public/suite.ts',
  'browser': 'src/public/browser.ts',
  'runners': 'src/public/runners.ts',
  'environments': 'src/public/environments.ts',
  'mocker': 'src/public/mocker.ts',
  'spy': 'src/integrations/spy.ts',
  'coverage': 'src/public/coverage.ts',
  'execute': 'src/public/execute.ts',
  'reporters': 'src/public/reporters.ts',
  // TODO: advanced docs
  'workers': 'src/public/workers.ts',

  // for performance reasons we bundle them separately so we don't import everything at once
  'worker': 'src/runtime/worker.ts',
  'workers/forks': 'src/runtime/workers/forks.ts',
  'workers/threads': 'src/runtime/workers/threads.ts',
  'workers/vmThreads': 'src/runtime/workers/vmThreads.ts',
  'workers/vmForks': 'src/runtime/workers/vmForks.ts',

  'workers/runVmTests': 'src/runtime/runVmTests.ts',

  'snapshot': 'src/public/snapshot.ts',
}

const dtsEntries = {
  index: 'src/public/index.ts',
  node: 'src/public/node.ts',
  environments: 'src/public/environments.ts',
  browser: 'src/public/browser.ts',
  runners: 'src/public/runners.ts',
  suite: 'src/public/suite.ts',
  config: 'src/public/config.ts',
  coverage: 'src/public/coverage.ts',
  execute: 'src/public/execute.ts',
  reporters: 'src/public/reporters.ts',
  mocker: 'src/public/mocker.ts',
  workers: 'src/public/workers.ts',
  snapshot: 'src/public/snapshot.ts',
}

const external = [
  ...builtinModules,
  ...Object.keys(pkg.dependencies),
  ...Object.keys(pkg.peerDependencies),
  'worker_threads',
  'node:worker_threads',
  'node:fs',
  'node:os',
  'node:stream',
  'node:vm',
  'node:http',
  'node:console',
  'inspector',
  'vitest/optional-types.js',
  'vite-node/source-map',
  'vite-node/client',
  'vite-node/server',
  'vite-node/constants',
  'vite-node/utils',
  '@vitest/mocker',
  '@vitest/mocker/node',
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

const dtsUtils = createDtsUtils()

const plugins = [
  nodeResolve({
    preferBuiltins: true,
  }),
  json(),
  commonjs(),
  oxc({
    transform: {
      target: 'node18',
      define: {
        // __VITEST_GENERATE_UI_TOKEN__ is set as a global to catch accidental leaking,
        // in the release version the "if" with this condition should not be present
        __VITEST_GENERATE_UI_TOKEN__: process.env.VITEST_GENERATE_UI_TOKEN === 'true' ? 'true' : 'false',
        ...(process.env.VITE_TEST_WATCHER_DEBUG === 'false'
          ? {
              'process.env.VITE_TEST_WATCHER_DEBUG': 'false',
            }
          : {}),
      },
    },
    sourcemap: true,
  }),
]

export default ({ watch }) =>
  defineConfig([
    {
      input: entries,
      treeshake: true,
      output: {
        dir: 'dist',
        format: 'esm',
        chunkFileNames: 'chunks/[name].[hash].js',
      },
      external,
      moduleContext: (id) => {
        // mime has `this.__classPrivateFieldGet` check which should be ignored in esm
        if (id.includes('mime/dist/src') || id.includes('mime\\dist\\src')) {
          return '{}'
        }
      },
      plugins: [
        ...dtsUtils.isolatedDecl(),
        ...plugins,
        !watch && licensePlugin(),
      ],
      onwarn,
    },
    {
      input: 'src/public/config.ts',
      output: [
        {
          file: 'dist/config.cjs',
          format: 'cjs',
        },
      ],
      external,
      plugins,
    },
    {
      input: dtsUtils.dtsInput(dtsEntries),
      output: {
        dir: 'dist',
        entryFileNames: chunk =>
          `${normalize(chunk.name).replace('src/', '')}.d.ts`,
        format: 'esm',
        chunkFileNames: 'chunks/[name].[hash].d.ts',
      },
      watch: false,
      external,
      plugins: dtsUtils.dts(),
    },
  ])

function licensePlugin() {
  return license({
    thirdParty(dependencies) {
      // https://github.com/rollup/rollup/blob/master/build-plugins/generate-license-file.js
      // MIT Licensed https://github.com/rollup/rollup/blob/master/LICENSE-CORE.md
      const coreLicense = fs.readFileSync(resolve(dir, '../../LICENSE'))
      const licenses = new Set()
      const dependencyLicenseTexts = dependencies
        .filter(({ name }) => !name?.startsWith('@vitest/'))
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
            if (license) {
              text += `License: ${license}\n`
            }

            const names = new Set()
            if (author && author.name) {
              names.add(author.name)
            }

            for (const person of maintainers.concat(contributors)) {
              if (person && person.name) {
                names.add(person.name)
              }
            }
            if (names.size > 0) {
              text += `By: ${Array.from(names).join(', ')}\n`
            }

            if (repository) {
              text += `Repository: ${repository.url || repository}\n`
            }

            if (!licenseText) {
              try {
                const pkgDir = dirname(
                  resolve(join(name, 'package.json'), {
                    preserveSymlinks: false,
                  }),
                )
                const [licenseFile] = globSync(`${pkgDir}/LICENSE*`, {
                  caseSensitiveMatch: false,
                  expandDirectories: false,
                })
                if (licenseFile) {
                  licenseText = fs.readFileSync(licenseFile, 'utf-8')
                }
              }
              catch {}
            }
            if (licenseText) {
              text += `\n${licenseText
                .trim()
                .replace(/(\r\n|\r)/g, '\n')
                .split('\n')
                .map(line => (line ? `> ${line}` : '>'))
                .join('\n')}\n`
            }
            licenses.add(license)
            return text
          },
        )
        .join('\n---------------------------------------\n\n')
      const licenseText
        = '# Vitest core license\n'
          + `Vitest is released under the MIT license:\n\n${coreLicense}\n# Licenses of bundled dependencies\n`
          + 'The published Vitest artifact additionally contains code with the following licenses:\n'
          + `${sortLicenses(licenses).join(', ')}\n\n`
          + `# Bundled dependencies:\n${dependencyLicenseTexts}`
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
  if (['EMPTY_BUNDLE', 'CIRCULAR_DEPENDENCY'].includes(message.code)) {
    return
  }
  console.error(message)
}

function sortLicenses(licenses) {
  let withParenthesis = []
  let noParenthesis = []
  licenses.forEach((license) => {
    if (/^\(/.test(license)) {
      withParenthesis.push(license)
    }
    else {
      noParenthesis.push(license)
    }
  })
  withParenthesis = withParenthesis.sort()
  noParenthesis = noParenthesis.sort()
  return [...noParenthesis, ...withParenthesis]
}
