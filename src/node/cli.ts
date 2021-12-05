import { fileURLToPath } from 'url'
import { resolve, dirname } from 'path'
import { findUp } from 'find-up'
import sade from 'sade'
import type { UserOptions } from '../types'
import { run as startViteNode } from './node.js'

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
  .option('--jsdom', 'mock browser api using JSDOM', false)
  .action(async(filters, options) => {
    process.env.VITEST = 'true'

    const __dirname = dirname(fileURLToPath(import.meta.url))
    const root = resolve(options.root || process.cwd())

    const configPath = options.config
      ? resolve(root, options.config)
      : await findUp(['vitest.config.ts', 'vitest.config.js', 'vitest.config.mjs', 'vite.config.ts', 'vite.config.js', 'vite.config.mjs'], { cwd: root })

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
        resolve(__dirname, options.dev ? '../../src/node/entry.ts' : './entry.js'),
      ],
      config: configPath,
      defaultConfig: {
        optimizeDeps: {
          exclude: [
            'vitest',
          ],
        },
      },
      shouldExternalize(id: string) {
        if (id.includes('/node_modules/vitest/'))
          return false
        else
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
