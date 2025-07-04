import type { ResolvedConfig, ServerDepsOptions } from './types/config'
import { existsSync, promises as fsp } from 'node:fs'
import { isBuiltin } from 'node:module'
import { pathToFileURL } from 'node:url'
import { KNOWN_ASSET_RE, slash } from '@vitest/utils'
import { findNearestPackageData } from '@vitest/utils/resolver'
import * as esModuleLexer from 'es-module-lexer'
import { dirname, extname, join, resolve } from 'pathe'
import { isWindows } from '../utils/env'

export class VitestResolver {
  private options: ExternalizeOptions
  private externalizeCache = new Map<string, Promise<string | false>>()

  constructor(cacheDir: string, config: ResolvedConfig) {
    this.options = {
      moduleDirectories: config.deps.moduleDirectories,
      inlineFiles: config.setupFiles.flatMap((file) => {
        if (file.startsWith('file://')) {
          return file
        }
        const resolvedId = resolve(file)
        return [resolvedId, pathToFileURL(resolvedId).href]
      }),
      cacheDir,
      inline: config.server.deps?.inline,
      external: config.server.deps?.external,
    }
  }

  public shouldExternalize(file: string): Promise<string | false> {
    return shouldExternalize(normalizeId(file), this.options, this.externalizeCache)
  }
}

function normalizeId(id: string) {
  if (id.startsWith('/@fs/')) {
    id = id.slice(isWindows ? 5 : 4)
  }
  return id
}

interface ExternalizeOptions extends ServerDepsOptions {
  moduleDirectories?: string[]
  inlineFiles?: string[]
  cacheDir?: string
}

const BUILTIN_EXTENSIONS = new Set(['.mjs', '.cjs', '.node', '.wasm'])

const ESM_EXT_RE = /\.(es|esm|esm-browser|esm-bundler|es6|module)\.js$/
const ESM_FOLDER_RE = /\/(es|esm)\/(.*\.js)$/

const defaultInline = [
  /virtual:/,
  /\.[mc]?ts$/,

  // special Vite query strings
  /[?&](init|raw|url|inline)\b/,
  // Vite returns a string for assets imports, even if it's inside "node_modules"
  KNOWN_ASSET_RE,

  /^(?!.*node_modules).*\.mjs$/,
  /^(?!.*node_modules).*\.cjs\.js$/,
  // Vite client
  /vite\w*\/dist\/client\/env.mjs/,
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
      if (existsSync(i)) {
        return i
      }
    }
  }
  if (id.match(ESM_FOLDER_RE)) {
    for (const i of [
      id.replace(ESM_FOLDER_RE, '/umd/$1'),
      id.replace(ESM_FOLDER_RE, '/cjs/$1'),
      id.replace(ESM_FOLDER_RE, '/lib/$1'),
      id.replace(ESM_FOLDER_RE, '/$1'),
    ]) {
      if (existsSync(i)) {
        return i
      }
    }
  }
}

// The code from https://github.com/unjs/mlly/blob/c5bcca0cda175921344fd6de1bc0c499e73e5dac/src/syntax.ts#L51-L98
async function isValidNodeImport(id: string) {
  const extension = extname(id)

  if (BUILTIN_EXTENSIONS.has(extension)) {
    return true
  }

  if (extension !== '.js') {
    return false
  }

  id = id.replace('file:///', '')

  const package_ = findNearestPackageData(dirname(id))

  if (package_.type === 'module') {
    return true
  }

  if (/\.(?:\w+-)?esm?(?:-\w+)?\.js$|\/esm?\//.test(id)) {
    return false
  }

  try {
    await esModuleLexer.init
    const code = await fsp.readFile(id, 'utf8')
    const [, , , hasModuleSyntax] = esModuleLexer.parse(code)
    return !hasModuleSyntax
  }
  catch {
    return false
  }
}

export async function shouldExternalize(
  id: string,
  options: ExternalizeOptions,
  cache: Map<string, Promise<string | false>>,
): Promise<string | false> {
  if (!cache.has(id)) {
    cache.set(id, _shouldExternalize(id, options))
  }
  return cache.get(id)!
}

async function _shouldExternalize(
  id: string,
  options?: ExternalizeOptions,
): Promise<string | false> {
  if (isBuiltin(id)) {
    return id
  }

  // data: should be processed by native import,
  // since it is a feature of ESM.
  // also externalize network imports since nodejs allows it when --experimental-network-imports
  if (id.startsWith('data:') || /^(?:https?:)?\/\//.test(id)) {
    return id
  }

  id = patchWindowsImportPath(id)

  const moduleDirectories = options?.moduleDirectories || ['/node_modules/']

  if (matchExternalizePattern(id, moduleDirectories, options?.inline)) {
    return false
  }
  if (options?.inlineFiles && options?.inlineFiles.includes(id)) {
    return false
  }
  if (matchExternalizePattern(id, moduleDirectories, options?.external)) {
    return id
  }

  // Unless the user explicitly opted to inline them, externalize Vite deps.
  // They are too big to inline by default.
  if (options?.cacheDir && id.includes(options.cacheDir)) {
    return id
  }

  const isLibraryModule = moduleDirectories.some(dir => id.includes(dir))
  const guessCJS = isLibraryModule && options?.fallbackCJS
  id = guessCJS ? guessCJSversion(id) || id : id

  if (matchExternalizePattern(id, moduleDirectories, defaultInline)) {
    return false
  }
  if (matchExternalizePattern(id, moduleDirectories, depsExternal)) {
    return id
  }

  if (isLibraryModule && (await isValidNodeImport(id))) {
    return id
  }

  return false
}

function matchExternalizePattern(
  id: string,
  moduleDirectories: string[],
  patterns?: (string | RegExp)[] | true,
) {
  if (patterns == null) {
    return false
  }
  if (patterns === true) {
    return true
  }
  for (const ex of patterns) {
    if (typeof ex === 'string') {
      if (moduleDirectories.some(dir => id.includes(join(dir, ex)))) {
        return true
      }
    }
    else {
      if (ex.test(id)) {
        return true
      }
    }
  }
  return false
}

function patchWindowsImportPath(path: string) {
  if (path.match(/^\w:\\/)) {
    return `file:///${slash(path)}`
  }
  else if (path.match(/^\w:\//)) {
    return `file:///${path}`
  }
  else {
    return path
  }
}
