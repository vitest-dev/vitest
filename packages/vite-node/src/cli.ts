import cac from 'cac'
import { dim, red } from 'kolorist'
import { createServer } from 'vite'
import { version } from '../package.json'
import { ViteNodeServer } from './server'
import { ViteNodeRunner } from './client'
import type { ViteNodeServerOptions } from './types'

const cli = cac('vite-node')

cli
  .version(version)
  .option('-r, --root <path>', 'Use specified root directory')
  .option('-c, --config <path>', 'Use specified config file')
  .option('-w, --watch', 'Restart on file changes, similar to "nodemon"')
  // TODO: How could we document this? Ideally, we should link to the
  // TODO: ViteNodeServerOptions type since it's the source of truth.
  .option('--server-options <options>', 'Use specified Vite server options')
  .help()

cli
  .command('[...files]')
  .action(run)

cli.parse()

export interface CliOptions {
  root?: string
  config?: string
  watch?: boolean
  serverOptions?: ViteNodeServerOptions
  '--'?: string[]
}

async function run(files: string[], options: CliOptions = {}) {
  if (!files.length) {
    console.error(red('No files specified.'))
    cli.outputHelp()
    process.exit(1)
  }

  // forward argv
  process.argv = [...process.argv.slice(0, 2), ...(options['--'] || [])]

  if (options.serverOptions)
    parseServerOptions(options.serverOptions)

  const server = await createServer({
    logLevel: 'error',
    configFile: options.config,
    root: options.root,
  })
  await server.pluginContainer.buildStart({})

  const node = new ViteNodeServer(server, options.serverOptions)

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

  if (!options.watch)
    await server.close()

  server.watcher.on('change', async (eventName, path) => {
    // eslint-disable-next-line no-console
    console.log(dim(`[${eventName}] ${path}`))

    // invalidate module cache but not node_modules
    Array.from(runner.moduleCache.keys())
      .forEach((i) => {
        if (!i.includes('node_modules'))
          runner.moduleCache.delete(i)
      })

    for (const file of files)
      await runner.executeFile(file)
  })
}

function parseServerOptions(serverOptions: ViteNodeServerOptions) {
  if (serverOptions.deps && serverOptions.deps.inline) {
    serverOptions.deps.inline = serverOptions.deps.inline.map((dep) => {
      return typeof dep === 'string' && dep.startsWith('/') && dep.endsWith('/')
        ? new RegExp(dep)
        : dep
    })
  }

  if (serverOptions.deps && serverOptions.deps.external) {
    serverOptions.deps.external = serverOptions.deps.external.map((dep) => {
      return typeof dep === 'string' && dep.startsWith('/') && dep.endsWith('/')
        ? new RegExp(dep)
        : dep
    })
  }

  // TODO: Handle serverOptions.transformMode.
}
