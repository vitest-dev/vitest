import { existsSync } from 'fs'
import { isNodeBuiltin, isValidNodeImport } from 'mlly'
import type { DepsHandlingOptions } from './types'
import { slash } from './utils'

const ESM_EXT_RE = /\.(es|esm|esm-browser|esm-bundler|es6|module)\.js$/
const ESM_FOLDER_RE = /\/esm\/(.*\.js)$/

const defaultInline = [
  /virtual:/,
  /\.ts$/,
  ESM_EXT_RE,
  ESM_FOLDER_RE,
]

const depsExternal = [
  /\.cjs\.js$/,
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
  options?: DepsHandlingOptions,
  cache = new Map<string, Promise<string | false>>(),
) {
  if (!cache.has(id))
    cache.set(id, _shouldExternalize(id, options))
  return cache.get(id)!
}

async function _shouldExternalize(
  id: string,
  options?: DepsHandlingOptions,
): Promise<string | false> {
  if (isNodeBuiltin(id))
    return id

  // data: should be processed by native import,
  // since it is a feature of ESM
  if (id.startsWith('data:'))
    return id

  id = patchWindowsImportPath(id)

  if (matchExternalizePattern(id, options?.inline))
    return false
  if (matchExternalizePattern(id, options?.external))
    return id

  const isNodeModule = id.includes('/node_modules/')
  id = isNodeModule ? guessCJSversion(id) || id : id

  if (matchExternalizePattern(id, defaultInline))
    return false
  if (matchExternalizePattern(id, depsExternal))
    return id

  const isDist = id.includes('/dist/')
  if ((isNodeModule || isDist) && await isValidNodeImport(id))
    return id

  return false
}

function matchExternalizePattern(id: string, patterns?: (string | RegExp)[]) {
  if (!patterns)
    return false
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

function patchWindowsImportPath(path: string) {
  if (path.match(/^\w:\\/))
    return `file:///${slash(path)}`
  else if (path.match(/^\w:\//))
    return `file:///${path}`
  else
    return path
}
