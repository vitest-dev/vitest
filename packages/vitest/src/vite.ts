// eslint-disable-next-line no-restricted-imports
import type { ResolvedConfig, ViteDevServer } from 'vite'
import { cleanUrl } from '@vitest/utils/helpers'
// eslint-disable-next-line no-restricted-imports
import * as vite from 'vite'

// TODO: if "peerDeps" works without "deps", then we just need this log
// if (vite.version !== staticVite.version) {
//   console.warn(`Vite version Vitest uses is different from the one installed in the root. Vitest uses ${staticVite.version}, while the root has ${vite.version}.`)
// }

export const parseAst: typeof vite.parseAst = vite.parseAst
export const parseAstAsync: typeof vite.parseAstAsync = vite.parseAstAsync
export const isRunnableDevEnvironment: typeof vite.isRunnableDevEnvironment = vite.isRunnableDevEnvironment
export const fetchModule: typeof vite.fetchModule = vite.fetchModule
export const searchForWorkspaceRoot: typeof vite.searchForWorkspaceRoot = vite.searchForWorkspaceRoot
export const mergeConfig: typeof vite.mergeConfig = vite.mergeConfig
export const createServer: typeof vite.createServer = vite.createServer
export const resolveConfig: typeof vite.resolveConfig = vite.resolveConfig
export const isCSSRequest: typeof vite.isCSSRequest = vite.isCSSRequest
export const isFileLoadingAllowed: typeof vite.isFileLoadingAllowed = vite.isFileLoadingAllowed
export const esbuildVersion: typeof vite.esbuildVersion = vite.esbuildVersion
export const defaultServerConditions: typeof vite.defaultServerConditions = vite.defaultServerConditions
export const version: typeof vite.version = vite.version
export const rollupVersion: typeof vite.rollupVersion = vite.rollupVersion
export const rolldownVersion: string | undefined = (vite as any).rolldownVersion
// eslint-disable-next-line no-restricted-imports
export type * from 'vite'

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
  return vite.isFileLoadingAllowed(config, filePath)
}

const FS_PREFIX = '/@fs/'
const VOLUME_RE = /^[A-Z]:/i

function fsPathFromId(id: string): string {
  const fsPath = vite.normalizePath(
    id.startsWith(FS_PREFIX) ? id.slice(FS_PREFIX.length) : id,
  )
  return fsPath[0] === '/' || VOLUME_RE.test(fsPath) ? fsPath : `/${fsPath}`
}

function fsPathFromUrl(url: string): string {
  return fsPathFromId(cleanUrl(url))
}
