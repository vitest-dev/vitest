import { existsSync } from 'fs'
import { isValidNodeImport } from 'mlly'
import type { ResolvedConfig } from '../types'

const ESM_EXT_RE = /\.(es|esm|esm-browser|esm-bundler|es6)\.js$/
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

export function replaceLast(str: string, matcher: string | RegExp, replacement: string) {
  if (typeof matcher === 'string') {
    const index = str.lastIndexOf(matcher)
    if (index < 0)
      return str
    return str.slice(0, index) + replacement + str.slice(index + matcher.length)
  }
  const matches = Array.from(str.matchAll(matcher))
  if (!matches.length)
    return str
  const match = matches[matches.length - 1]!
  const index = match.index!
  return str.slice(0, index) + match[0].replace(matcher, replacement) + str.slice(index + match[0].length)
}

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

export async function shouldExternalize(id: string, config: Pick<ResolvedConfig, 'depsInline' | 'depsExternal' | 'fallbackCJS'>) {
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
