import cac from 'cac'
import { dim, red } from 'kolorist'
import { createServer } from 'vite'
import { version } from '../package.json'
import { ViteNodeServer } from './server'
import { ViteNodeRunner } from './client'

const cli = cac('vite-node')

cli
  .version(version)
  .option('-r, --root <path>', 'Use specified root directory')
  .option('-c, --config <path>', 'Use specified config file')
  .option('-w, --watch', 'Restart on file changes, similar to "nodemon"')
  .help()

cli
  .command('[...files]')
  .action(run)

cli.parse()

export interface CliOptions {
  root?: string
  config?: string
  watch?: boolean
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

  const server = await createServer({
    logLevel: 'error',
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
