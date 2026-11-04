import type { WorkerGlobalState } from '../../types/worker'
import { pathToFileURL } from 'node:url'
import { splitFileAndPostfix } from '@vitest/utils/helpers'
import { normalize } from 'pathe'
import { distDir } from '../../paths'

const platform = process.platform
const bareVitestRegexp = /^@?vitest(?:\/|$)/
const normalizedDistDir = normalize(distDir)
const relativeIds: Record<string, string> = {}
const externalizeMap = new Map<string, string>()

function getRelativeDistDir(root: string): string {
  const normalizedRoot = normalize(root).replace(/\/+$/, '') || '/'
  const rootPrefix = normalizedRoot === '/' ? normalizedRoot : `${normalizedRoot}/`
  return normalizedDistDir.startsWith(rootPrefix)
    ? normalizedDistDir.slice(normalizedRoot.length)
    : ''
}

// all Vitest imports always need to be externalized
export function getCachedVitestImport(
  id: string,
  state: () => WorkerGlobalState,
): null | { externalize: string; type: 'module' } {
  if (id.startsWith('/@fs/') || id.startsWith('\\@fs\\')) {
    id = id.slice(platform === 'win32' ? 5 : 4)
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
    // Vite resolves the Windows drive letter in upper case, but Node.js caches
    // modules by URL, so keep the drive letter Vitest itself was loaded with
    const path = file.startsWith(normalizedDistDir)
      ? distDir + file.slice(normalizedDistDir.length)
      : file
    const externalize = id.startsWith('file://') ? id : `${pathToFileURL(path)}${postfix}`
    externalizeMap.set(id, externalize)
    return { externalize, type: 'module' }
  }
  if (
    // "relative" to root path:
    // /node_modules/.pnpm/vitest/dist
    relativeRoot &&
    relativeRoot !== '/' &&
    id.startsWith(relativeRoot)
  ) {
    const { file, postfix } = splitFileAndPostfix(id)
    // This branch only matches ids inside Vitest's own dist directory
    // (`relativeRoot` is `distDir` relative to the project root). Rebuilding
    // the path from `root` would use the root's drive letter casing, which on
    // Windows can differ from the casing Node.js actually loaded Vitest with
    // (derived from `import.meta.url` in `paths.ts`, e.g. when the CLI is
    // started from a lower-case drive-letter cwd while Vite resolves the
    // root with an upper-case drive letter). Node.js caches modules by URL
    // string, so a casing mismatch here loads a second copy of the Vitest
    // runtime where `describe`/`afterEach` are registered without a runner
    // ("Vitest failed to find the current suite"). Keep the casing of the
    // already-loaded Vitest instance instead.
    const path = distDir + file.slice(relativeRoot.length)
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
