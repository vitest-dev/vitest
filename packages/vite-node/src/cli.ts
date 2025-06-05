import type { ChangeTypeDeep, ViteNodeServerOptions } from './types'
import { resolve } from 'node:path'
import cac from 'cac'
import c from 'tinyrainbow'
import { createServer, loadEnv, version as viteVersion } from 'vite'
import { version } from '../package.json'
import { ViteNodeRunner } from './client'
import { createHotContext, handleMessage, viteNodeHmrPlugin } from './hmr'
import { ViteNodeServer } from './server'
import { installSourcemapsSupport } from './source-map'
import { toArray } from './utils'

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

cli.command('[...files]').allowUnknownOptions().action(run)

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

// cac only passes strings, not RegExp (or in this nested options case, boolean as well)
export type ViteNodeServerOptionsCLI = ChangeTypeDeep<ViteNodeServerOptions, RegExp | boolean, string>

export interface CliOptions {
  'root'?: string
  'script'?: boolean
  'config'?: string
  'mode'?: string
  'watch'?: boolean
  'options'?: ViteNodeServerOptionsCLI
  'version'?: boolean
  'help'?: boolean
  '--'?: string[]
}

async function run(files: string[], options: CliOptions = {}) {
  if (options.script) {
    files = [files[0]]
    options = {}
    process.argv = [
      process.argv[0],
      resolve(files[0]),
      ...process.argv
        .slice(2)
        .filter(arg => arg !== '--script' && arg !== files[0]),
    ]
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
      watch: options.watch ? undefined : null,
    },
    plugins: [options.watch && viteNodeHmrPlugin()],
  })
  if (Number(viteVersion.split('.')[0]) < 6) {
    await server.pluginContainer.buildStart({})
  }
  else {
    // directly access client plugin container until https://github.com/vitejs/vite/issues/19607
    await server.environments.client.pluginContainer.buildStart({})
  }

  const env = loadEnv(server.config.mode, server.config.envDir, '')

  for (const key in env) {
    process.env[key] ??= env[key]
  }

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

  for (const file of files) {
    await runner.executeFile(file)
  }

  if (!options.watch) {
    await server.close()
  }

  server.emitter?.on('message', (payload) => {
    handleMessage(runner, server.emitter, files, payload)
  })

  if (options.watch) {
    process.on('uncaughtException', (err) => {
      console.error(c.red('[vite-node] Failed to execute file: \n'), err)
    })

    if (process.env.VITE_TEST_WATCHER_DEBUG) {
      // manually check `watcher.getWatched()` to make sure entry files are ready
      // since watcher.on('ready', ...) event is not reliable since 5.1.
      // https://github.com/vitejs/vite/blob/63a39c244b08cf1f2299bc2c3cfddcb82070d05b/playground/hmr-ssr/__tests__/hmr.spec.ts#L1065

      const nodePath = await import('node:path')

      async function waitForWatched(files: string[]): Promise<void> {
        while (!files.every(file => isWatched(file))) {
          await new Promise(resolve => setTimeout(resolve, 20))
        }
      }

      function isWatched(file: string): boolean {
        const watched = server.watcher.getWatched()
        const resolved = nodePath.resolve(file)
        const dir = nodePath.dirname(resolved)
        const base = nodePath.basename(resolved)
        return watched[dir]?.includes(base)
      }

      await waitForWatched(files)

      console.log('[debug] watcher is ready')
    }
  }
}

function parseServerOptions(
  serverOptionsCli: ViteNodeServerOptionsCLI,
): ViteNodeServerOptions {
  const serverOptions: ChangeTypeDeep<ViteNodeServerOptions, RegExp, string> = deepCoerceBooleans(serverOptionsCli)
  const inlineOptions
    = serverOptions.deps?.inline === true
      ? true
      : toArray(serverOptions.deps?.inline)

  return {
    ...serverOptions,
    deps: {
      ...serverOptions.deps,
      inlineFiles: toArray(serverOptions.deps?.inlineFiles),
      inline:
        inlineOptions === true
          ? true
          : inlineOptions.map(dep =>
              dep.startsWith('/') && dep.endsWith('/')
                ? new RegExp(dep)
                : dep,
            ),
      external: toArray(serverOptions.deps?.external).map((dep) => {
        return dep.startsWith('/') && dep.endsWith('/') ? new RegExp(dep) : dep
      }),
      moduleDirectories: serverOptions.deps?.moduleDirectories
        ? toArray(serverOptions.deps?.moduleDirectories)
        : undefined,
    },

    transformMode: {
      ...serverOptions.transformMode,
      ssr: toArray(serverOptions.transformMode?.ssr).map(
        dep => new RegExp(dep),
      ),
      web: toArray(serverOptions.transformMode?.web).map(
        dep => new RegExp(dep),
      ),
    },
  }
}

/** Convert "true"/"false" string values to booleans deeply. */
function deepCoerceBooleans(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(deepCoerceBooleans)
  }
  else if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, deepCoerceBooleans(v)]))
  }
  else if (typeof obj === 'string') {
    const lower = obj.toLowerCase()
    if (lower === 'true') {
      return true
    }
    if (lower === 'false') {
      return false
    }
    return obj
  }
  return obj
}
