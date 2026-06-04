import type { InlineConfig, ResolvedConfig, ViteDevServer } from 'vite'
import { cleanUrl } from '@vitest/utils/helpers'
import { createServer, isFileLoadingAllowed, normalizePath } from 'vite'

export async function createViteServer(inlineConfig: InlineConfig): Promise<ViteDevServer> {
  // Vite prints an error (https://github.com/vitejs/vite/issues/14328)
  // But Vitest works correctly either way
  const error = console.error
  console.error = (...args: any[]) => {
    if (
      typeof args[0] === 'string'
      && args[0].includes('WebSocket server error:')
    ) {
      return
    }
    error(...args)
  }

  const server = await createServer(inlineConfig)

  console.error = error
  return server
}

// backward compat implementation
/**
 * Check if the url is allowed to be served, via the `server.fs` config.
 * @deprecated Use the `isFileLoadingAllowed` function instead.
 */
export function isFileServingAllowed(
  config: ResolvedConfig,
  url: string,
): boolean
export function isFileServingAllowed(
  url: string,
  server: ViteDevServer,
): boolean
export function isFileServingAllowed(
  configOrUrl: ResolvedConfig | string,
  urlOrServer: string | ViteDevServer,
): boolean {
  const config = (
    typeof urlOrServer === 'string' ? configOrUrl : urlOrServer.config
  ) as ResolvedConfig
  const url = (
    typeof urlOrServer === 'string' ? urlOrServer : configOrUrl
  ) as string

  if (!config.server.fs.strict) {
    return true
  }
  const filePath = fsPathFromUrl(url)
  return isFileLoadingAllowed(config, filePath)
}

const FS_PREFIX = '/@fs/'
const VOLUME_RE = /^[A-Z]:/i

function fsPathFromId(id: string): string {
  const fsPath = normalizePath(
    id.startsWith(FS_PREFIX) ? id.slice(FS_PREFIX.length) : id,
  )
  return fsPath[0] === '/' || VOLUME_RE.test(fsPath) ? fsPath : `/${fsPath}`
}

function fsPathFromUrl(url: string): string {
  return fsPathFromId(cleanUrl(url))
}
