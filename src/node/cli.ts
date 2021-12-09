/* eslint-disable no-console */
import sade from 'sade'
import c from 'picocolors'
import type { UserOptions, VitestContext } from '../types'
import { version } from '../../package.json'
import { DefaultReporter } from '../reporters/default'
import { initViteServer } from './server'
import { start } from './start'
import { StateManager } from './state'

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

    const ctx = process.__vitest__ = {
      server,
      config,
      moduleCache: new Map(),
      state: new StateManager(),
      reporter: config.reporter,
    }

    ctx.reporter ||= new DefaultReporter(ctx)

    try {
      await start(ctx)
    }
    catch (e) {
      process.exitCode = 1
      throw e
    }
    finally {
      if (!config.watch)
        await server.close()
    }
    // const timer = setTimeout(() => {
    //   // TODO: warn user and maybe error out
    //   process.exit()
    // }, 500)
    // timer.unref()
  })
  .parse(process.argv)

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Process {
      __vitest__: VitestContext
    }
  }
}
