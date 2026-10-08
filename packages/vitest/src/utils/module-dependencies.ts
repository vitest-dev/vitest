import type { EvaluatedModules } from 'vite/module-runner'
import module from 'node:module'
import { fileURLToPath } from 'node:url'
import { slash } from '@vitest/utils/helpers'
import { distDir } from '../paths'

type ImportsLookup = (id: string) => Iterable<string> | undefined

const vitestDistDir = `${slash(distDir)}/`

/**
 * Ids of the roots and of every module reachable from them through the runtime import edges.
 */
export function collectDependencies(
  getImports: ImportsLookup,
  ...roots: Iterable<string>[]
): string[] {
  const visited = new Set<string>()
  const queue: string[] = []
  for (const ids of roots) {
    for (const id of ids) {
      if (!visited.has(id)) {
        visited.add(id)
        queue.push(id)
      }
    }
  }
  while (queue.length) {
    const imports = getImports(queue.pop()!)
    if (!imports) {
      continue
    }
    for (const id of imports) {
      if (!visited.has(id)) {
        visited.add(id)
        queue.push(id)
      }
    }
  }
  return Array.from(visited)
}

export function getEvaluatedImports(evaluatedModules: EvaluatedModules): ImportsLookup {
  return (id) => evaluatedModules.getModuleById(id)?.imports
}

class NativeImportGraph {
  private imports = new Map<string, Set<string>>()

  /**
   * Returns the imported file, or `undefined` if the import is not tracked.
   */
  record(url: string, parentURL: string): string | undefined {
    if (!url.startsWith('file:') || url.includes('/node_modules/')) {
      return
    }
    const file = slash(fileURLToPath(url))
    const importer = parentURL.startsWith('file:') ? slash(fileURLToPath(parentURL)) : parentURL
    // Vitest imports every test file, its edges would connect unrelated test files
    if (!importer.startsWith(vitestDistDir)) {
      let imports = this.imports.get(importer)
      if (!imports) {
        this.imports.set(importer, (imports = new Set()))
      }
      imports.add(file)
    }
    return file
  }

  getImports: ImportsLookup = (id) => this.imports.get(id)
}

/**
 * Import edges of the modules loaded with native `import`, reported by a Node.js resolve hook.
 * Node.js never loads a module twice, so the edges are kept as long as the thread runs.
 */
export const nativeImports: NativeImportGraph = new NativeImportGraph()

let trackingNativeImports = false

/**
 * Registers a resolve hook that records the native imports of this thread.
 * Returns `false` if the runtime has no synchronous module hooks.
 */
export function trackNativeImports(): boolean {
  if (!trackingNativeImports && typeof module.registerHooks === 'function') {
    module.registerHooks({
      resolve(specifier, context, nextResolve) {
        const result = nextResolve(specifier, context)
        if (context.parentURL) {
          nativeImports.record(result.url, context.parentURL)
        }
        return result
      },
    })
    trackingNativeImports = true
  }
  return trackingNativeImports
}
