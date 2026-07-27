import type { WorkerGlobalState } from '../../types/worker'
import { pathToFileURL } from 'node:url'
import { splitFileAndPostfix } from '@vitest/utils/helpers'
import { join, normalize } from 'pathe'
import { distDir } from '../../paths'

const bareVitestRegexp = /^@?vitest(?:\/|$)/
const normalizedDistDir = normalize(distDir)
const relativeIds: Record<string, string> = {}
const externalizeMap = new Map<string, string>()

const fileUrlDriveRegexp = /^(file:\/\/\/)([a-z])(?=:)/i
const distDirDrive = /^([a-z])(?=:)/i.exec(distDir)?.[1]

// Windows keeps the drive letter of a path in the case it was written in, so
// Vitest can be loaded through `c:\…` (the working directory the process was
// started from) while Vite normalizes module ids to `C:/…`. Node keys its
// module registry on the URL, so externalizing a test file's `vitest` import
// to the other spelling evaluates a second copy of the runtime. That copy
// never goes through `clearCollectorContext`, so its `runner` is undefined and
// the first `describe()` in the file throws. Always hand back the drive letter
// Vitest itself was loaded with.
function withLoadedVitestDrive(externalize: string): string {
  if (!distDirDrive) {
    return externalize
  }
  return externalize.replace(fileUrlDriveRegexp, (match, prefix: string, drive: string) =>
    drive.toLowerCase() === distDirDrive.toLowerCase()
      ? `${prefix}${distDirDrive}`
      : match)
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
  if (id.includes(distDir) || id.includes(normalizedDistDir)) {
    const { file, postfix } = splitFileAndPostfix(id)
    const externalize = withLoadedVitestDrive(id.startsWith('file://')
      ? id
      : `${pathToFileURL(file)}${postfix}`)
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
    const externalize = withLoadedVitestDrive(`${pathToFileURL(path)}${postfix}`)
    externalizeMap.set(id, externalize)
    return { externalize, type: 'module' }
  }
  if (bareVitestRegexp.test(id)) {
    externalizeMap.set(id, id)
    return { externalize: id, type: 'module' }
  }
  return null
}
