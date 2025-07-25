import fs from 'node:fs'
import { dirname, join } from 'pathe'

const packageCache = new Map<string, { type?: 'module' | 'commonjs' }>()

export function findNearestPackageData(
  basedir: string,
): { type?: 'module' | 'commonjs' } {
  const originalBasedir = basedir
  while (basedir) {
    const cached = getCachedData(packageCache, basedir, originalBasedir)
    if (cached) {
      return cached
    }

    const pkgPath = join(basedir, 'package.json')
    if (tryStatSync(pkgPath)?.isFile()) {
      const pkgData = JSON.parse(stripBomTag(fs.readFileSync(pkgPath, 'utf8')))

      if (packageCache) {
        setCacheData(packageCache, pkgData, basedir, originalBasedir)
      }

      return pkgData
    }

    const nextBasedir = dirname(basedir)
    if (nextBasedir === basedir) {
      break
    }
    basedir = nextBasedir
  }

  return {}
}

function stripBomTag(content: string): string {
  if (content.charCodeAt(0) === 0xFEFF) {
    return content.slice(1)
  }

  return content
}

function tryStatSync(file: string): fs.Stats | undefined {
  try {
    // The "throwIfNoEntry" is a performance optimization for cases where the file does not exist
    return fs.statSync(file, { throwIfNoEntry: false })
  }
  catch {
    // Ignore errors
  }
}

export function getCachedData<T>(
  cache: Map<string, T>,
  basedir: string,
  originalBasedir: string,
): NonNullable<T> | undefined {
  const pkgData = cache.get(getFnpdCacheKey(basedir))
  if (pkgData) {
    traverseBetweenDirs(originalBasedir, basedir, (dir) => {
      cache.set(getFnpdCacheKey(dir), pkgData)
    })
    return pkgData
  }
}

export function setCacheData<T>(
  cache: Map<string, T>,
  data: T,
  basedir: string,
  originalBasedir: string,
): void {
  cache.set(getFnpdCacheKey(basedir), data)
  traverseBetweenDirs(originalBasedir, basedir, (dir) => {
    cache.set(getFnpdCacheKey(dir), data)
  })
}

function getFnpdCacheKey(basedir: string) {
  return `fnpd_${basedir}`
}

/**
 * Traverse between `longerDir` (inclusive) and `shorterDir` (exclusive) and call `cb` for each dir.
 * @param longerDir Longer dir path, e.g. `/User/foo/bar/baz`
 * @param shorterDir Shorter dir path, e.g. `/User/foo`
 */
function traverseBetweenDirs(
  longerDir: string,
  shorterDir: string,
  cb: (dir: string) => void,
) {
  while (longerDir !== shorterDir) {
    cb(longerDir)
    longerDir = dirname(longerDir)
  }
}
