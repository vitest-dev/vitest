import { ViteDevServer } from 'vite'
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
