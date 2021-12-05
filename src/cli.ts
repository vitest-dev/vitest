import minimist from 'minimist'
import c from 'picocolors'
import { ViteDevServer } from 'vite'
import { run } from './run'

const { log } = console

const argv = minimist(process.argv.slice(2), {
  alias: {
    u: 'update',
    w: 'watch',
  },
  string: ['root', 'config'],
  boolean: ['update', 'dev', 'global', 'watch', 'jsdom'],
  unknown(name) {
    if (name[0] === '-') {
      console.error(c.red(`Unknown argument: ${name}`))
      help()
      process.exit(1)
    }
    return true
  },
})

if (!process.__vite_node__)
  throw new Error('Vite can only run in Vite environment, please use the CLI to start the process')

const server = process.__vite_node__.server as ViteDevServer
const viteConfig = server?.config || {}
const testOptions = viteConfig.test || {}

await run({
  ...argv,
  ...testOptions,
  server,
  updateSnapshot: argv.update,
  rootDir: argv.root || process.cwd(),
  nameFilters: argv._,
})

function help() {
  log('Help: finish help')
}
