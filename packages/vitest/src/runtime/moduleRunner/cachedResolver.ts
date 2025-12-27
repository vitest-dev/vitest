import type { WorkerGlobalState } from '../../types/worker'
import { pathToFileURL } from 'node:url'
import { join, normalize } from 'pathe'
import { distDir } from '../../paths'

const bareVitestRegexp = /^@?vitest(?:\/|$)/
const normalizedDistDir = normalize(distDir)
const relativeIds: Record<string, string> = {}
const externalizeMap = new Map<string, string>()

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
  const relativeRoot = relativeIds[root] ?? (relativeIds[root] = normalizedDistDir.slice(root.length))
  if (id.includes(distDir) || id.includes(normalizedDistDir)) {
    const externalize = id.startsWith('file://')
      ? id
      : pathToFileURL(id).toString()
    externalizeMap.set(id, externalize)
    return { externalize, type: 'module' }
  }
  if (
    // "relative" to root path:
    // /node_modules/.pnpm/vitest/dist
    (relativeRoot && relativeRoot !== '/' && id.startsWith(relativeRoot))
  ) {
    const path = join(root, id)
    const externalize = pathToFileURL(path).toString()
    externalizeMap.set(id, externalize)
    return { externalize, type: 'module' }
  }
  if (bareVitestRegexp.test(id)) {
    externalizeMap.set(id, id)
    return { externalize: id, type: 'module' }
  }
  return null
}
