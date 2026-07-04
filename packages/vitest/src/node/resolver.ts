import type { ModuleType } from '../types/general'
import type { ResolvedConfig, ServerDepsOptions } from './types/config'
import { existsSync, promises as fsp, readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { pathToFileURL } from 'node:url'
import { KNOWN_ASSET_RE } from '@vitest/utils/constants'
import { cleanUrl } from '@vitest/utils/helpers'
import { findNearestPackageData } from '@vitest/utils/resolver'
import * as esModuleLexer from 'es-module-lexer'
import { basename, dirname, extname, join, resolve } from 'pathe'
import {
  ssrExportAllKey,
  ssrImportKey,
  ssrImportMetaKey,
  ssrModuleExportsKey,
} from 'vite/module-runner'
import { isWindows } from '../utils/env'

export class VitestResolver {
  public readonly options: ExternalizeOptions
  private externalizeConcurrentCache = new Map<string, Promise<string | false | undefined>>()
  public externalizeCache: Map<string, string | false | undefined> = new Map()

  constructor(cacheDir: string, config: ResolvedConfig) {
    // sorting to make cache consistent
    const inline = config.server.deps?.inline
    if (Array.isArray(inline)) {
      inline.sort()
    }
    const external = config.server.deps?.external
    if (Array.isArray(external)) {
      external.sort()
    }
    this.options = {
      moduleDirectories: config.deps.moduleDirectories?.sort(),
      inlineFiles: config.setupFiles.flatMap((file) => {
        if (file.startsWith('file://')) {
          return file
        }
        const resolvedId = resolve(file)
        return [resolvedId, pathToFileURL(resolvedId).href]
      }),
      cacheDir,
      inline,
      external,
    }
  }

  public wasExternalized(file: string): string | false {
    const normalizedFile = normalizeId(file)
    if (!this.externalizeCache.has(normalizedFile)) {
      return false
    }
    return this.externalizeCache.get(normalizedFile) ?? false
  }

  public async shouldExternalize(file: string): Promise<string | false | undefined> {
    const normalizedFile = normalizeId(file)
    if (this.externalizeCache.has(normalizedFile)) {
      return this.externalizeCache.get(normalizedFile)!
    }

    return shouldExternalize(normalizeId(file), this.options, this.externalizeConcurrentCache).then((result) => {
      this.externalizeCache.set(normalizedFile, result)
      return result
    }).finally(() => {
      this.externalizeConcurrentCache.delete(normalizedFile)
    })
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
  if (ESM_EXT_RE.test(id)) {
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
  if (ESM_FOLDER_RE.test(id)) {
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
  // clean url to strip off `?v=...` query etc.
  // node can natively import files with query params, so externalizing them is safe.
  id = cleanUrl(id)

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

const ESM_SYNTAX_MARKERS = [
  ssrImportKey,
  ssrModuleExportsKey,
  ssrExportAllKey,
  ssrImportMetaKey,
  // TODO: use ssrExportNameKey when Vite 6 support is over
  '__vite_ssr_exportName__',
]

// mirrors the Node.js module detection algorithm: the file extension wins,
// then the `type` field in the package scope, then the presence of
// ESM syntax. the ssr transform always rewrites static imports/exports and
// `import.meta` into `__vite_ssr_` helpers, so the transformed code can be
// checked instead of parsing the original source. dynamic imports don't
// count because they are allowed in CommonJS modules
export function detectModuleType(file: string | null, code: string): ModuleType {
  if (file) {
    const filepath = cleanUrl(file)
    const extension = extname(filepath)
    if (extension === '.cjs' || extension === '.cts') {
      return 'cjs'
    }
    if (extension === '.mjs' || extension === '.mts') {
      return 'esm'
    }
    const scopeType = lookupPackageScopeType(dirname(filepath))
    if (scopeType !== 'none') {
      return scopeType
    }
  }
  return ESM_SYNTAX_MARKERS.some(marker => code.includes(marker)) ? 'esm' : 'cjs'
}

const packageScopeTypeCache = new Map<string, ModuleType | 'none'>()

// mirrors LOOKUP_PACKAGE_SCOPE from the ESM resolution algorithm:
// the lookup stops at the first package.json and never crosses
// the "node_modules" boundary, so typeless dependencies don't
// inherit the `type` field of the user's project
function lookupPackageScopeType(directory: string): ModuleType | 'none' {
  const visited: string[] = []
  let result: ModuleType | 'none' = 'none'
  let current = directory
  while (current) {
    const cached = packageScopeTypeCache.get(current)
    if (cached) {
      result = cached
      break
    }
    if (basename(current) === 'node_modules') {
      break
    }
    visited.push(current)
    const packageJsonPath = join(current, 'package.json')
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'))
        if (packageJson.type === 'module') {
          result = 'esm'
        }
        else if (packageJson.type === 'commonjs') {
          result = 'cjs'
        }
      }
      catch {}
      break
    }
    const parent = dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }
  visited.forEach(dir => packageScopeTypeCache.set(dir, result))
  return result
}

export async function shouldExternalize(
  id: string,
  options: ExternalizeOptions,
  cache: Map<string, Promise<string | false | undefined>>,
): Promise<string | false | undefined> {
  if (!cache.has(id)) {
    cache.set(id, _shouldExternalize(id, options))
  }
  return cache.get(id)!
}

async function _shouldExternalize(
  id: string,
  options?: ExternalizeOptions,
): Promise<string | false | undefined> {
  if (isBuiltin(id)) {
    return id
  }

  // data: should be processed by native import,
  // since it is a feature of ESM.
  // also externalize network imports since nodejs allows it when --experimental-network-imports
  if (id.startsWith('data:') || /^(?:https?:)?\/\//.test(id)) {
    return id
  }

  const moduleDirectories = options?.moduleDirectories || ['/node_modules/']

  if (matchPattern(id, moduleDirectories, options?.inline)) {
    return false
  }
  if (options?.inlineFiles && options?.inlineFiles.includes(id)) {
    return false
  }
  if (matchPattern(id, moduleDirectories, options?.external)) {
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

  if (matchPattern(id, moduleDirectories, defaultInline)) {
    return false
  }
  if (matchPattern(id, moduleDirectories, depsExternal)) {
    return id
  }

  if (isLibraryModule && (await isValidNodeImport(id))) {
    return id
  }
}

function matchPattern(
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
