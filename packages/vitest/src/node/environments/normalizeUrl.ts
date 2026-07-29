import type { DevEnvironment } from 'vite'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { cleanUrl, withTrailingSlash, wrapId } from '@vitest/utils/helpers'

// this is copy pasted from vite
export function normalizeResolvedIdToUrl(
  environment: DevEnvironment,
  resolvedId: string,
): string {
  const root = environment.config.root
  const depsOptimizer = environment.depsOptimizer

  let url: string

  // normalize all imports into resolved URLs
  // e.g. `import 'foo'` -> `import '/@fs/.../node_modules/foo/index.js'`
  if (resolvedId.startsWith(withTrailingSlash(root))) {
    // in root: infer short absolute path from root
    url = resolvedId.slice(root.length)
  }
  else if (
    depsOptimizer?.isOptimizedDepFile(resolvedId)
    // vite-plugin-react isn't following the leading \0 virtual module convention.
    // This is a temporary hack to avoid expensive fs checks for React apps.
    // We'll remove this as soon we're able to fix the react plugins.
    || (resolvedId !== '/@react-refresh'
      && path.isAbsolute(resolvedId)
      && existsSync(cleanUrl(resolvedId)))
  ) {
    // an optimized deps may not yet exists in the filesystem, or
    // a regular file exists but is out of root: rewrite to absolute /@fs/ paths
    url = path.posix.join('/@fs/', resolvedId)
  }
  else {
    url = resolvedId
  }

  // if the resolved id is not a valid browser import specifier,
  // prefix it to make it valid. We will strip this before feeding it
  // back into the transform pipeline
  if (url[0] !== '.' && url[0] !== '/') {
    url = wrapId(resolvedId)
  }

  return url
}
