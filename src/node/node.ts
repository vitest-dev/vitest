import { createServer, mergeConfig, InlineConfig, ViteDevServer } from 'vite'
import { ExecuteOptions, executeInViteNode, ModuleCache } from './execute'

declare global {
  namespace NodeJS {
    interface Process {
      __vite_node__: {
        server: ViteDevServer
        watch?: boolean
        moduleCache: Map<string, ModuleCache>
      }
    }
  }
}

export const moduleCache = new Map<string, ModuleCache>()

export interface ViteNodeOptions {
  silent?: boolean
  root: string
  files: string[]
  _?: string[]
  shouldExternalize?: (file: string, server: ViteDevServer) => boolean
  config?: string
  defaultConfig?: InlineConfig
}

export async function run(options: ViteNodeOptions) {
  process.exitCode = 0

  const root = options.root || process.cwd()
  process.chdir(root)

  const files = options.files || options._

  options.shouldExternalize = options.shouldExternalize || (id => id.includes('/node_modules/'))

  const server = await createServer(mergeConfig(options.defaultConfig || {}, {
    logLevel: 'error',
    clearScreen: false,
    configFile: options.config,
    root,
    resolve: {},
  }))
  await server.pluginContainer.buildStart({})

  process.__vite_node__ = {
    server,
    moduleCache,
  }

  const defaultInline = [
    'vue',
    '@vue',
    'diff',
  ]

  const executeOptions: ExecuteOptions = {
    root: server.config.root,
    files,
    fetch: id => transform(server, id),
    inline: ['vitest', ...defaultInline, ...server.config.test?.deps?.inline || []],
    external: server.config.test?.deps?.external || [],
    moduleCache,
  }

  try {
    await executeInViteNode(executeOptions)
  }
  catch (e) {
    process.exitCode = 1
    throw e
  }
  finally {
    if (!process.__vite_node__.watch)
      await server.close()
  }
}

async function transform(server: ViteDevServer, id: string) {
  if (id.match(/\.(?:[cm]?[jt]sx?|json)$/)) {
    return await server.transformRequest(id, { ssr: true })
  }
  else {
    // for components like Vue, we want to use the client side
    // plugins but then covert the code to be consumed by the server
    const result = await server.transformRequest(id)
    if (!result)
      return undefined
    return await server.ssrTransform(result.code, result.map, id)
  }
}
