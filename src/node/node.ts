import { ViteDevServer } from 'vite'
import { install } from 'source-map-support'
import { ResolvedConfig } from '../types'
import { ExecuteOptions, executeInViteNode, ModuleCache } from './execute'
import { transformRequest } from './transform'

export async function run(server: ViteDevServer, config: ResolvedConfig, moduleCache: Map<string, ModuleCache>, files: string[]) {
  const executeOptions: ExecuteOptions = {
    root: server.config.root,
    files,
    fetch: id => transformRequest(server, id),
    inline: config.depsInline,
    external: config.depsExternal,
    moduleCache,
  }

  install({
    environment: 'node',
    hookRequire: true,
    handleUncaughtExceptions: true,
    retrieveSourceMap: (id: string) => {
      const map = moduleCache.get(id)?.transformResult?.map
      if (map) {
        return {
          url: id,
          map: map as any,
        }
      }
      return null
    },
  })

  try {
    await executeInViteNode(executeOptions)
  }
  catch (e) {
    process.exitCode = 1
    throw e
  }
  finally {
    if (!config.watch)
      await server.close()
  }
}
