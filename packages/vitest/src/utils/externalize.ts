import { existsSync } from 'fs'
import { isNodeBuiltin, isValidNodeImport } from 'mlly'
import type { ResolvedConfig } from '../types'
import { slash } from '../utils'

const ESM_EXT_RE = /\.(es|esm|esm-browser|esm-bundler|es6|module)\.js$/
const ESM_FOLDER_RE = /\/esm\/(.*\.js)$/

const defaultInline = [
  /\/vitest\/dist\//,
  // yarn's .store folder
  /vitest-virtual-\w+\/dist/,
  /virtual:/,
  /\.ts$/,
  ESM_EXT_RE,
  ESM_FOLDER_RE,
]

const depsExternal = [
  /\.cjs.js$/,
  /\.mjs$/,
]

export function guessCJSversion(id: string): string | undefined {
  if (id.match(ESM_EXT_RE)) {
    for (const i of [
      id.replace(ESM_EXT_RE, '.mjs'),
      id.replace(ESM_EXT_RE, '.umd.js'),
      id.replace(ESM_EXT_RE, '.cjs.js'),
      id.replace(ESM_EXT_RE, '.js'),
    ]) {
      if (existsSync(i))
        return i
    }
  }
  if (id.match(ESM_FOLDER_RE)) {
    for (const i of [
      id.replace(ESM_FOLDER_RE, '/umd/$1'),
      id.replace(ESM_FOLDER_RE, '/cjs/$1'),
      id.replace(ESM_FOLDER_RE, '/$1'),
    ]) {
      if (existsSync(i))
        return i
    }
  }
}

export async function shouldExternalize(
  id: string,
  config: Pick<ResolvedConfig, 'depsInline' | 'depsExternal' | 'fallbackCJS'>,
  cache = new Map<string, Promise<string | false>>(),
) {
  if (!cache.has(id))
    cache.set(id, _shouldExternalize(id, config))
  return cache.get(id)!
}

async function _shouldExternalize(
  id: string,
  config: Pick<ResolvedConfig, 'depsInline' | 'depsExternal' | 'fallbackCJS'>,
): Promise<string | false> {
  if (isNodeBuiltin(id))
    return id

  id = patchWindowsImportPath(id)

  if (matchExternalizePattern(id, config.depsInline))
    return false
  if (matchExternalizePattern(id, config.depsExternal))
    return id

  const isNodeModule = id.includes('/node_modules/')

  id = isNodeModule ? guessCJSversion(id) || id : id

  if (matchExternalizePattern(id, defaultInline))
    return false
  if (matchExternalizePattern(id, depsExternal))
    return id

  if (isNodeModule && await isValidNodeImport(id))
    return id

  return false
}

function matchExternalizePattern(id: string, patterns: (string | RegExp)[]) {
  for (const ex of patterns) {
    if (typeof ex === 'string') {
      if (id.includes(`/node_modules/${ex}/`))
        return true
    }
    else {
      if (ex.test(id))
        return true
    }
  }
  return false
}

export function patchWindowsImportPath(path: string) {
  if (path.match(/^\w:\\/))
    return `file:///${slash(path)}`
  else if (path.match(/^\w:\//))
    return `file:///${path}`
  else
    return path
}
