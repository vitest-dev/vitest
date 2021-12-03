import { join } from 'path'
import minimist from 'minimist'
import c from 'picocolors'
import { ViteDevServer } from 'vite'
import { run } from './run'

const { log } = console

const argv = minimist(process.argv.slice(2), {
  alias: {
    u: 'update',
  },
  string: ['root', 'config'],
  boolean: ['update', 'dev'],
  unknown(name) {
    if (name[0] === '-') {
      console.error(c.red(`Unknown argument: ${name}`))
      help()
      process.exit(1)
    }
    return true
  },
})

// @ts-expect-error
const server = process?.__vite_node__?.server as ViteDevServer
const viteConfig = server?.config || {}
const testOptions = viteConfig.test || {}

await run({
  ...testOptions,
  updateSnapshot: argv.update,
  rootDir: argv.root || process.cwd(),
})

function help() {
  log('Help: finish help')
}
