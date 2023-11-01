import { existsSync, promises as fsp } from 'node:fs'
import { dirname, extname, join } from 'pathe'
import type { DepsHandlingOptions } from './types'
import { findNearestPackageData, isNodeBuiltin, slash } from './utils'
import { KNOWN_ASSET_TYPES } from './constants'

const BUILTIN_EXTENSIONS = new Set(['.mjs', '.cjs', '.node', '.wasm'])

const ESM_SYNTAX_RE
  = /([\s;]|^)(import[\s\w*,{}]*from|import\s*["'*{]|export\b\s*(?:[*{]|default|class|type|function|const|var|let|async function)|import\.meta\b)/m
const ESM_EXT_RE = /\.(es|esm|esm-browser|esm-bundler|es6|module)\.js$/
const ESM_FOLDER_RE = /\/(es|esm)\/(.*\.js)$/

const defaultInline = [
  /virtual:/,
  /\.[mc]?ts$/,

  // special Vite query strings
  /[?&](init|raw|url|inline)\b/,
  // Vite returns a string for assets imports, even if it's inside "node_modules"
  new RegExp(`\\.(${KNOWN_ASSET_TYPES.join('|')})$`),
]

const depsExternal = [
  /\/node_modules\/.*\.cjs\.js$/,
  /\/node_modules\/.*\.mjs$/,
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
      id.replace(ESM_FOLDER_RE, '/lib/$1'),
      id.replace(ESM_FOLDER_RE, '/$1'),
    ]) {
      if (existsSync(i))
        return i
    }
  }
}

// The code from https://github.com/unjs/mlly/blob/c5bcca0cda175921344fd6de1bc0c499e73e5dac/src/syntax.ts#L51-L98
async function isValidNodeImport(id: string) {
  const extension = extname(id)

  if (BUILTIN_EXTENSIONS.has(extension))
    return true

  if (extension !== '.js')
    return false

  if (/\.(\w+-)?esm?(-\w+)?\.js$|\/(esm?)\//.test(id))
    return false

  id = id.replace('file:///', '')

  const package_ = await findNearestPackageData(dirname(id))

  if (package_.type === 'module')
    return true

  const code = await fsp.readFile(id, 'utf8').catch(() => '')

  return !ESM_SYNTAX_RE.test(code)
}

const _defaultExternalizeCache = new Map<string, Promise<string | false>>()
export async function shouldExternalize(
  id: string,
  options?: DepsHandlingOptions,
  cache = _defaultExternalizeCache,
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

  // always externalize Vite deps, they are too big to inline
  if (options?.cacheDir && id.includes(options.cacheDir))
    return id

  const moduleDirectories = options?.moduleDirectories || ['/node_modules/']

  if (matchExternalizePattern(id, moduleDirectories, options?.inline))
    return false
  if (matchExternalizePattern(id, moduleDirectories, options?.external))
    return id

  const isLibraryModule = moduleDirectories.some(dir => id.includes(dir))
  const guessCJS = isLibraryModule && options?.fallbackCJS
  id = guessCJS ? (guessCJSversion(id) || id) : id

  if (matchExternalizePattern(id, moduleDirectories, defaultInline))
    return false
  if (matchExternalizePattern(id, moduleDirectories, depsExternal))
    return id

  if (isLibraryModule && await isValidNodeImport(id))
    return id

  return false
}

function matchExternalizePattern(id: string, moduleDirectories: string[], patterns?: (string | RegExp)[] | true) {
  if (patterns == null)
    return false
  if (patterns === true)
    return true
  for (const ex of patterns) {
    if (typeof ex === 'string') {
      if (moduleDirectories.some(dir => id.includes(join(dir, ex))))
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
