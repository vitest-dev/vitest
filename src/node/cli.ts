/* eslint-disable no-console */
import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { findUp } from 'find-up'
import sade from 'sade'
import c from 'picocolors'
import type { ResolvedConfig, UserOptions } from '../types'
import { run as startViteNode } from './node'

console.log(c.yellow(c.bold('\nVitest is currently in closed beta exclusively for Sponsors')))
console.log(c.magenta(`Become a Sponsor of ${c.underline('https://github.com/sponsors/patak-js')} or ${c.underline('https://github.com/sponsors/antfu')} \nto access the source code and issues tracker 💖\n`))

// TODO: use bundler
const version = '0.0.0'

sade('vitest [filter]', true)
  .version(version)
  .describe('A blazing fast unit test framework powered by Vite.')
  .option('-r, --root', 'root path', process.cwd())
  .option('-c, --config', 'path to config file')
  .option('-w, --watch', 'watch mode', false)
  .option('-u, --update', 'update snapshot', false)
  .option('--global', 'inject apis globally', false)
  .option('--dev', 'dev mode', false)
  .option('--dom', 'mock browser api using jsdom or happy-dom', '')
  .action(async(filters, argv) => {
    process.env.VITEST = 'true'

    const defaultInline = [
      'vue',
      '@vue',
      'diff',
    ]

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const root = resolve(argv.root || process.cwd())
    const configPath = argv.config
      ? resolve(root, argv.config)
      : await findUp(['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'vite.config.ts', 'vite.config.js', 'vite.config.mjs'], { cwd: root })

    const options = argv as ResolvedConfig

    options.config = configPath
    options.root = root
    options.filters = filters
      ? Array.isArray(filters)
        ? filters
        : [filters]
      : undefined

    process.__vitest__ = {
      options,
    }

    await startViteNode({
      root,
      files: [
        resolve(__dirname, argv.dev ? '../../src/node/entry.ts' : './entry.js'),
      ],
      config: configPath,
      defaultConfig: {
        optimizeDeps: {
          exclude: [
            'vitest',
          ],
        },
      },
      shouldExternalize(id, server) {
        const inline = ['vitest', ...defaultInline, ...server.config.test?.deps?.inline || []]
        const external = server.config.test?.deps?.external || []
        for (const ex of inline) {
          if (typeof ex === 'string') {
            if (id.includes(`/node_modules/${ex}/`))
              return false
          }
          else {
            if (ex.test(id))
              return false
          }
        }
        for (const ex of external) {
          if (typeof ex === 'string') {
            if (id.includes(`/node_modules/${ex}/`))
              return true
          }
          else {
            if (ex.test(id))
              return true
          }
        }

        return id.includes('/node_modules/')
      },
    })
  })
  .parse(process.argv)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __vitest__: {
        options: Required<UserOptions>
      }
    }
  }
}
