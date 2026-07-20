import fs from 'node:fs'
import { basename, dirname, join } from 'pathe'

const packageScopeTypeCache = new Map<string, 'cjs' | 'esm' | 'none'>()

// mirrors LOOKUP_PACKAGE_SCOPE from the ESM resolution algorithm:
// the lookup stops at the first package.json and never crosses
// the "node_modules" boundary, so typeless dependencies don't
// inherit the `type` field of the user's project
export function lookupPackageScopeType(
  directory: string,
): 'cjs' | 'esm' | 'none' {
  const visited: string[] = []
  let result: 'cjs' | 'esm' | 'none' = 'none'
  let current = directory
  while (current) {
    const cached = packageScopeTypeCache.get(current)
    if (cached) {
      result = cached
      break
    }
    if (basename(current) === 'node_modules') {
      break
    }
    visited.push(current)
    const packageJsonPath = join(current, 'package.json')
    if (tryStatSync(packageJsonPath)?.isFile()) {
      try {
        const packageJson = JSON.parse(stripBomTag(fs.readFileSync(packageJsonPath, 'utf8')))
        if (packageJson.type === 'module') {
          result = 'esm'
        }
        else if (packageJson.type === 'commonjs') {
          result = 'cjs'
        }
      }
      catch {
        // ignore malformed package.json and fall back to "none"
      }
      break
    }

    const parent = dirname(current)
    if (parent === current) {
      break
    }
    current = parent
  }

  visited.forEach(dir => packageScopeTypeCache.set(dir, result))
  return result
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
