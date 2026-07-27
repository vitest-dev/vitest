import type { WorkerGlobalState } from '../../types/worker'
import { pathToFileURL } from 'node:url'
import { splitFileAndPostfix } from '@vitest/utils/helpers'
import { join, normalize } from 'pathe'
import { distDir } from '../../paths'

const bareVitestRegexp = /^@?vitest(?:\/|$)/
const normalizedDistDir = normalize(distDir)
const relativeIds: Record<string, string> = {}
const externalizeMap = new Map<string, string>()

// Windows paths are case-insensitive, so the same file can be spelled several
// ways. `distDir` comes from `import.meta.url` and keeps the case the CLI was
// invoked with, while ids come from Vite and carry the case of `process.cwd()`
// with an uppercase drive. Node keys its module registry on the URL, so
// externalizing a test file's `vitest` import to a different spelling of the
// same file evaluates a second copy of the runtime. That copy never goes
// through `clearCollectorContext`, so its `runner` is undefined and the first
// `describe()` in the file throws. Match Vitest's own dist directory
// regardless of case, and always hand back the spelling Vitest was loaded
// with. Only on Windows: elsewhere two spellings really are two files.
const isWindows = process.platform === 'win32'
const distDirUrl = pathToFileURL(distDir).href
const lowerDistDir = distDir.toLowerCase()
const lowerNormalizedDistDir = normalizedDistDir.toLowerCase()
const lowerDistDirUrl = distDirUrl.toLowerCase()

function isVitestDistId(id: string): boolean {
  if (id.includes(distDir) || id.includes(normalizedDistDir)) {
    return true
  }
  if (!isWindows) {
    return false
  }
  const lowerId = id.toLowerCase()
  return lowerId.includes(lowerDistDir)
    || lowerId.includes(lowerNormalizedDistDir)
    || lowerId.includes(lowerDistDirUrl)
}

function withLoadedVitestCasing(externalize: string): string {
  if (!isWindows) {
    return externalize
  }
  const index = externalize.toLowerCase().indexOf(lowerDistDirUrl)
  if (index === -1) {
    return externalize
  }
  return externalize.slice(0, index)
    + distDirUrl
    + externalize.slice(index + distDirUrl.length)
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
  const relativeRoot = relativeIds[root] ?? (relativeIds[root] = normalizedDistDir.slice(root.length))
  if (isVitestDistId(id)) {
    const { file, postfix } = splitFileAndPostfix(id)
    const externalize = id.startsWith('file://')
      ? withLoadedVitestCasing(id)
      : `${withLoadedVitestCasing(pathToFileURL(file).href)}${postfix}`
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
    const externalize = `${withLoadedVitestCasing(pathToFileURL(path).href)}${postfix}`
    externalizeMap.set(id, externalize)
    return { externalize, type: 'module' }
  }
  if (bareVitestRegexp.test(id)) {
    externalizeMap.set(id, id)
    return { externalize: id, type: 'module' }
  }
  return null
}
