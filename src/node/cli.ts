/* eslint-disable no-console */
import { resolve } from 'path'
import sade from 'sade'
import c from 'picocolors'
import type { ViteDevServer } from 'vite'
import type { ResolvedConfig, UserOptions } from '../types'
import { version } from '../../package.json'
import { distDir } from '../constants'
import { run } from './node'
import { initViteServer } from './server'
import { ModuleCache } from './execute'

sade('vitest [filter]', true)
  .version(version)
  .describe('A blazing fast unit test framework powered by Vite.')
  .option('-r, --root', 'root path', process.cwd())
  .option('-c, --config', 'path to config file')
  .option('-w, --watch', 'watch mode', false)
  .option('-u, --update', 'update snapshot', false)
  .option('--global', 'inject apis globally', false)
  .option('--dom', 'mock browser api using jsdom or happy-dom', '')
  .action(async(filters, argv: UserOptions) => {
    process.env.VITEST = 'true'

    console.log(c.yellow(c.bold('\nVitest is currently in closed beta exclusively for Sponsors')))
    console.log(c.magenta(`Become a Sponsor of ${c.underline('https://github.com/sponsors/patak-js')} or ${c.underline('https://github.com/sponsors/antfu')} \nto access the source code and issues tracker 💖\n`))

    const { config, server } = await initViteServer({ ...argv, filters })

    const moduleCache = new Map<string, ModuleCache>()
    process.__vitest__ = {
      server,
      config,
      moduleCache,
    }

    await run(server, config, moduleCache, [
      resolve(distDir, './node/entry.js'),
    ])
  })
  .parse(process.argv)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __vitest__: {
        config: ResolvedConfig
        server: ViteDevServer
        moduleCache: Map<string, ModuleCache>
      }
    }
  }
}
