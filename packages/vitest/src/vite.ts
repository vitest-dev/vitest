// eslint-disable-next-line no-restricted-imports
import type { ResolvedConfig, RunnableDevEnvironment, ViteDevServer } from 'vite'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { cleanUrl } from '@vitest/utils/helpers'
import { parse } from 'acorn'
import { resolveModule } from 'local-pkg'

const require = createRequire(import.meta.url)
const workspaceVite = require.resolve('vite', { paths: [process.cwd()] })
const VITE_CJS_IGNORE_WARNING = process.env.VITE_CJS_IGNORE_WARNING
process.env.VITE_CJS_IGNORE_WARNING = 'true'
// Import the version which is installed by the user.
// In v5 this should be replaced with `peerDependency`.
// This monstrosity of a file is required only to avoid breaking changes in v4.
const vite: typeof import('vite') = require(workspaceVite || 'vite')
process.env.VITE_CJS_IGNORE_WARNING = VITE_CJS_IGNORE_WARNING

export const parseAst: typeof vite.parseAst = (input, options) => {
  try {
    return vite.parseAst(input, options)
  }
  catch (error) {
    // Fallback for Vite versions that don't support require(esm) (Node <= 20.19)
    if (isViteCJSError(error)) {
      return parse(input, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        allowReturnOutsideFunction: options?.allowReturnOutsideFunction,
        allowAwaitOutsideFunction: true,
      }) as any
    }
    throw error
  }
}
export const parseAstAsync: typeof vite.parseAstAsync = async (input, options) => {
  try {
    return await vite.parseAstAsync(input, options)
  }
  catch (error) {
    // Fallback for Vite versions that don't support require(esm) (Node <= 20.19)
    if (isViteCJSError(error)) {
      return parse(input, {
        sourceType: 'module',
        ecmaVersion: 'latest',
        allowReturnOutsideFunction: options?.allowReturnOutsideFunction,
        allowAwaitOutsideFunction: true,
      }) as any
    }
    throw error
  }
}

export const isRunnableDevEnvironment: typeof vite.isRunnableDevEnvironment = (environment): environment is RunnableDevEnvironment => {
  try {
    // It is not exposed by CJS wrapper in older Vite 6 version.
    return vite.isRunnableDevEnvironment(environment)
  }
  catch {
    // No framework supports runnable environment in Vite 6
    return false
  }
}

let esmVite: typeof import('vite')
export const fetchModule: typeof vite.fetchModule = async (environment, url, importer, options) => {
  try {
    return await vite.fetchModule(environment, url, importer, options)
  }
  catch (error) {
    if (!isViteCJSError(error)) {
      throw error
    }

    if (!esmVite) {
      const vitePath = resolveModule('vite', { paths: [process.cwd()] })
      esmVite = await import(vitePath ? pathToFileURL(vitePath).toString() : 'vite')
    }
    return await esmVite.fetchModule(environment, url, importer, options)
  }
}

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

function isViteCJSError(error: unknown) {
  return error instanceof Error && error.message.includes('is not available in the CJS build of Vite.')
}
