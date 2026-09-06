import type { WorkerGlobalState } from '../../types/worker'
import { pathToFileURL } from 'node:url'
import { splitFileAndPostfix } from '@vitest/utils/helpers'
import { join, normalize } from 'pathe'
import { distDir } from '../../paths'

const bareVitestRegexp = /^@?vitest(?:\/|$)/
const normalizedDistDir = normalize(distDir)
const relativeIds: Record<string, string> = {}
const externalizeMap = new Map<string, string>()

// The dist directory is only "relative" to the root when it actually lives inside
// it (e.g. <root>/node_modules/.pnpm/vitest/dist). In a monorepo Vitest is usually
// hoisted above the project root, and slicing would then produce an unrelated
// suffix of the dist path (e.g. "st" or "t") that matches bare specifiers such as
// "stream" or "tls" by prefix, externalizing them to <root>/stream.
function getRelativeDistDir(root: string): string {
  const normalizedRoot = normalize(root)
  // drop a trailing slash so it is not counted twice when slicing
  const base = normalizedRoot.endsWith('/')
    ? normalizedRoot.slice(0, -1)
    : normalizedRoot
  return normalizedDistDir.startsWith(`${base}/`)
    ? normalizedDistDir.slice(base.length)
    : ''
}

// all Vitest imports always need to be externalized
export function getCachedVitestImport(
  id: string,
  state: () => WorkerGlobalState,
): null | { externalize: string; type: 'module' } {
  if (id.startsWith('/@fs/') || id.startsWith('\\@fs\\')) {
    id = id.slice(process.platform === 'win32' ? 5 : 4)
  }

  if (externalizeMap.has(id)) {
    return { externalize: externalizeMap.get(id)!, type: 'module' }
  }
  // always externalize Vitest because we import from there before running tests
  // so we already have it cached by Node.js
  const root = state().config.root
  const relativeRoot = relativeIds[root] ?? (relativeIds[root] = getRelativeDistDir(root))
  if (id.includes(distDir) || id.includes(normalizedDistDir)) {
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
    (relativeRoot && relativeRoot !== '/' && id.startsWith(relativeRoot))
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
