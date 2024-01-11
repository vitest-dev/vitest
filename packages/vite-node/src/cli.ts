import { resolve } from 'node:path'
import cac from 'cac'
import c from 'picocolors'
import { createServer } from 'vite'
import { version } from '../package.json'
import { ViteNodeServer } from './server'
import { ViteNodeRunner } from './client'
import type { ViteNodeServerOptions } from './types'
import { toArray } from './utils'
import { createHotContext, handleMessage, viteNodeHmrPlugin } from './hmr'
import { installSourcemapsSupport } from './source-map'

const cli = cac('vite-node')

cli
  .option('-r, --root <path>', 'Use specified root directory')
  .option('-c, --config <path>', 'Use specified config file')
  .option('-m, --mode <mode>', 'Set env mode')
  .option('-w, --watch', 'Restart on file changes, similar to "nodemon"')
  .option('--script', 'Use vite-node as a script runner')
  .option('--options <options>', 'Use specified Vite server options')
  .option('-v, --version', 'Output the version number')
  .option('-h, --help', 'Display help for command')

cli
  .command('[...files]')
  .allowUnknownOptions()
  .action(run)

cli.parse(process.argv, { run: false })

if (cli.args.length === 0) {
  cli.runMatchedCommand()
}
else {
  const i = cli.rawArgs.indexOf(cli.args[0]) + 1
  const scriptArgs = cli.rawArgs.slice(i).filter(it => it !== '--')
  const executeArgs = [...cli.rawArgs.slice(0, i), '--', ...scriptArgs]
  cli.parse(executeArgs)
}

export interface CliOptions {
  root?: string
  script?: boolean
  config?: string
  mode?: string
  watch?: boolean
  options?: ViteNodeServerOptionsCLI
  version?: boolean
  help?: boolean
  '--'?: string[]
}

async function run(files: string[], options: CliOptions = {}) {
  if (options.script) {
    files = [files[0]]
    options = {}
    process.argv = [process.argv[0], resolve(files[0]), ...process.argv.slice(2).filter(arg => arg !== '--script' && arg !== files[0])]
  }
  else {
    process.argv = [...process.argv.slice(0, 2), ...(options['--'] || [])]
  }

  if (options.version) {
    cli.version(version)
    cli.outputVersion()
    process.exit(0)
  }
  if (options.help) {
    cli.version(version).outputHelp()
    process.exit(0)
  }
  if (!files.length) {
    console.error(c.red('No files specified.'))
    cli.version(version).outputHelp()
    process.exit(1)
  }

  const serverOptions = options.options
    ? parseServerOptions(options.options)
    : {}

  const server = await createServer({
    logLevel: 'error',
    configFile: options.config,
    root: options.root,
    mode: options.mode,
    server: {
      hmr: !!options.watch,
    },
    plugins: [
      options.watch && viteNodeHmrPlugin(),
    ],
  })
  await server.pluginContainer.buildStart({})

  const node = new ViteNodeServer(server, serverOptions)

  installSourcemapsSupport({
    getSourceMap: source => node.getSourceMap(source),
  })

  const runner = new ViteNodeRunner({
    root: server.config.root,
    base: server.config.base,
    fetchModule(id) {
      return node.fetchModule(id)
    },
    resolveId(id, importer) {
      return node.resolveId(id, importer)
    },
    createHotContext(runner, url) {
      return createHotContext(runner, server.emitter, files, url)
    },
  })

  // provide the vite define variable in this context
  await runner.executeId('/@vite/env')

  for (const file of files)
    await runner.executeFile(file)

  if (!options.watch)
    await server.close()

  server.emitter?.on('message', (payload) => {
    handleMessage(runner, server.emitter, files, payload)
  })

  if (options.watch) {
    process.on('uncaughtException', (err) => {
      console.error(c.red('[vite-node] Failed to execute file: \n'), err)
    })
  }
}

function parseServerOptions(serverOptions: ViteNodeServerOptionsCLI): ViteNodeServerOptions {
  const inlineOptions = serverOptions.deps?.inline === true ? true : toArray(serverOptions.deps?.inline)

  return {
    ...serverOptions,
    deps: {
      ...serverOptions.deps,
      inline: inlineOptions !== true
        ? inlineOptions.map((dep) => {
          return (dep.startsWith('/') && dep.endsWith('/'))
            ? new RegExp(dep)
            : dep
        })
        : true,
      external: toArray(serverOptions.deps?.external).map((dep) => {
        return (dep.startsWith('/') && dep.endsWith('/'))
          ? new RegExp(dep)
          : dep
      }),
      moduleDirectories: serverOptions.deps?.moduleDirectories
        ? toArray(serverOptions.deps?.moduleDirectories)
        : undefined,
    },

    transformMode: {
      ...serverOptions.transformMode,
      ssr: toArray(serverOptions.transformMode?.ssr).map(dep => new RegExp(dep)),
      web: toArray(serverOptions.transformMode?.web).map(dep => new RegExp(dep)),
    },
  }
}

type Optional<T> = T | undefined
type ComputeViteNodeServerOptionsCLI<T extends Record<string, any>> = {
  [K in keyof T]: T[K] extends Optional<RegExp[]>
    ? string | string[]
    : T[K] extends Optional<(string | RegExp)[]>
      ? string | string[]
      : T[K] extends Optional<(string | RegExp)[] | true>
        ? string | string[] | true
        : T[K] extends Optional<Record<string, any>>
          ? ComputeViteNodeServerOptionsCLI<T[K]>
          : T[K]
}

export type ViteNodeServerOptionsCLI = ComputeViteNodeServerOptionsCLI<ViteNodeServerOptions>
