import { isValidNodeImport } from 'mlly'
import type { ExecuteOptions } from '../node/execute'

const defaultInline = [
  /\/vitest\/dist\//,
  // yarn's .store folder
  /vitest-virtual-\w+\/dist/,
  /virtual:/,
  /\.ts$/,
  /\/esm\/.*\.js$/,
  /\.(es|esm|esm-browser|esm-bundler|es6).js$/,
]

const depsExternal = [
  /\.cjs.js$/,
  /\.mjs$/,
]

export async function shouldExternalize(id: string, config: Pick<ExecuteOptions, 'inline' | 'external'>) {
  if (matchExternalizePattern(id, config.inline))
    return false
  if (matchExternalizePattern(id, config.external))
    return true

  if (matchExternalizePattern(id, defaultInline))
    return false
  if (matchExternalizePattern(id, depsExternal))
    return true

  return id.includes('/node_modules/') && await isValidNodeImport(id)
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
