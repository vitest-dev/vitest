import { join } from 'path'
import minimist from 'minimist'
import c from 'picocolors'
import { run } from './run'

const { log } = console

const argv = minimist(process.argv.slice(2), {
  alias: {
    u: 'update',
  },
  string: ['root'],
  boolean: ['update'],
  unknown(name) {
    if (name[0] === '-') {
      console.error(c.red(`Unknown argument: ${name}`))
      help()
      process.exit(1)
    }
    return true
  },
})

// TODO: load config, CLI
await run({
  rootDir: argv.root || join(process.cwd(), 'test'),
  updateSnapshot: argv.update,
})

function help() {
  log('Help: finish help')
}
