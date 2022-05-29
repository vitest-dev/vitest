import cac from 'cac'
import { cyan, dim, red } from 'kolorist'
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
  .option('--options <options>', 'Use specified Vite server options')
  .help()

cli
  .command('[...files]')
  .action(run)

cli.parse()

export interface CliOptions {
  root?: string
  config?: string
  watch?: boolean
  options?: ViteNodeServerOptionsCLI
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

  const parsedServerOptions = options.options
    ? parseServerOptions(options.options)
    : undefined

  const server = await createServer({
    logLevel: 'error',
    configFile: options.config,
    root: options.root,
  })
  await server.pluginContainer.buildStart({})

  const node = new ViteNodeServer(server, parsedServerOptions)

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

  server.watcher.on('change', async (path) => {
    // eslint-disable-next-line no-console
    console.log(`${cyan('[vite-node]')} File change detected. ${dim(path)}`)

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

function parseServerOptions(serverOptions: ViteNodeServerOptionsCLI): ViteNodeServerOptions {
  return {
    ...serverOptions,
    deps: {
      ...serverOptions.deps,
      inline: serverOptions.deps?.inline?.map((dep) => {
        return dep.startsWith('/') && dep.endsWith('/')
          ? new RegExp(dep)
          : dep
      }),
      external: serverOptions.deps?.external?.map((dep) => {
        return dep.startsWith('/') && dep.endsWith('/')
          ? new RegExp(dep)
          : dep
      }),
    },

    transformMode: {
      ...serverOptions.transformMode,

      ssr: serverOptions.transformMode?.ssr?.map(dep => new RegExp(dep)),
      web: serverOptions.transformMode?.ssr?.map(dep => new RegExp(dep)),
    },
  }
}

type Optional<T> = T | undefined
type ComputeViteNodeServerOptionsCLI<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends Optional<RegExp[]>
    ? string[]
    : T[K] extends Optional<(string | RegExp)[]>
      ? string[]
      : T[K] extends Optional<Record<string, any>>
        ? ComputeViteNodeServerOptionsCLI<T[K]>
        : T[K]
}

export type ViteNodeServerOptionsCLI = ComputeViteNodeServerOptionsCLI<ViteNodeServerOptions>
