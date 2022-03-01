import minimist from 'minimist'
import { dim, red } from 'kolorist'
import { createServer } from 'vite'
import { ViteNodeServer } from './server'
import { ViteNodeRunner } from './client'

const argv = minimist(process.argv.slice(2), {
  'alias': {
    r: 'root',
    c: 'config',
    h: 'help',
    w: 'watch',
    s: 'silent',
  },
  '--': true,
  'string': ['root', 'config'],
  'boolean': ['help', 'watch', 'silent'],
  unknown(name: string) {
    if (name[0] === '-') {
      console.error(red(`Unknown argument: ${name}`))
      help()
      process.exit(1)
    }
    return true
  },
})

if (argv.help) {
  help()
  process.exit(0)
}

if (!argv._.length) {
  console.error(red('No files specified.'))
  help()
  process.exit(1)
}

// forward argv
process.argv = [...process.argv.slice(0, 2), ...(argv['--'] || [])]

run(argv)

function help() {
  // eslint-disable-next-line no-console
  console.log(`
Usage:
  $ vite-node [options] [files]

Options:
  -r, --root <path>      ${dim('[string]')} use specified root directory
  -c, --config <file>    ${dim('[string]')} use specified config file
  -w, --watch           ${dim('[boolean]')} restart on file changes, similar to "nodemon"
  -s, --silent          ${dim('[boolean]')} do not emit errors and logs
  --vue                 ${dim('[boolean]')} support for importing Vue component
`)
}

export interface CliOptions {
  files?: string[]
  _?: string[]
  root?: string
  config?: string
}

async function run(options: CliOptions = {}) {
  const files = options.files || options._ || []

  const server = await createServer({
    logLevel: 'error',
    clearScreen: false,
    configFile: options.config,
    root: options.root,
  })
  await server.pluginContainer.buildStart({})

  const node = new ViteNodeServer(server)

  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    },
  })

  // provide the vite define variable in this context
  await runner.executeId('/@vite/env')

  for (const file of files)
    await runner.executeFile(file)

  await server.close()
}
