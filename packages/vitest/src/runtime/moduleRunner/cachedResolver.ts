import type { WorkerGlobalState } from '../../types/worker'
import { pathToFileURL } from 'node:url'
import { splitFileAndPostfix } from '@vitest/utils/helpers'
import { join, normalize } from 'pathe'
import { distDir } from '../../paths'

const bareVitestRegexp = /^@?vitest(?:\/|$)/
const normalizedDistDir = normalize(distDir)
const isWindows = process.platform === 'win32'
const distDirMatcher = isWindows ? distDir.toLowerCase() : distDir
const normalizedDistDirMatcher = isWindows ? normalizedDistDir.toLowerCase() : normalizedDistDir
const relativeIds: Record<string, string> = {}
const externalizeMap = new Map<string, string>()

function getMatcher(id: string): string {
  return isWindows ? id.toLowerCase() : id
}

function normalizeDriveLetter(id: string, root: string): string {
  if (id[1] === ':' && root[1] === ':' && id[0].toLowerCase() === root[0].toLowerCase()) {
    return root[0] + id.slice(1)
  }
  return id
}

// all Vitest imports always need to be externalized
export function getCachedVitestImport(
  id: string,
  state: () => WorkerGlobalState,
): null | { externalize: string; type: 'module' } {
  if (id.startsWith('/@fs/') || id.startsWith('\\@fs\\')) {
    id = id.slice(process.platform === 'win32' ? 5 : 4)
  }

  let root: string | undefined
  if (isWindows && id[1] === ':') {
    root = state().config.root
    id = normalizeDriveLetter(id, root)
  }

  if (externalizeMap.has(id)) {
    return { externalize: externalizeMap.get(id)!, type: 'module' }
  }
  // always externalize Vitest because we import from there before running tests
  // so we already have it cached by Node.js
  root ??= state().config.root
  const relativeRoot = relativeIds[root] ?? (relativeIds[root] = normalizedDistDir.slice(root.length))
  const idMatcher = getMatcher(id)
  if (idMatcher.includes(distDirMatcher) || idMatcher.includes(normalizedDistDirMatcher)) {
    const { file, postfix } = splitFileAndPostfix(id)
    const externalize = id.startsWith('file://')
      ? id
      : `${pathToFileURL(file)}${postfix}`
    externalizeMap.set(id, externalize)
    return { externalize, type: 'module' }
  }
  if (
    // "relative" to root path:
    // /node_modules/.pnpm/vitest/dist
    (relativeRoot && relativeRoot !== '/' && idMatcher.startsWith(getMatcher(relativeRoot)))
  ) {
    const { file, postfix } = splitFileAndPostfix(id)
    const path = join(root, file)
    const externalize = `${pathToFileURL(path)}${postfix}`
    externalizeMap.set(id, externalize)
    return { externalize, type: 'module' }
  }
  if (bareVitestRegexp.test(id)) {
    externalizeMap.set(id, id)
    return { externalize: id, type: 'module' }
  }
  return null
}
