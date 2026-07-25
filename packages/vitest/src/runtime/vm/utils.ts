import type { VMSourceTextModule, VMSyntheticModule } from './types'
import vm from 'node:vm'
import { initSync, parse } from 'es-module-lexer'

export function interopCommonJsModule(
  interopDefault: boolean | undefined,
  mod: any,
): {
  keys: string[]
  moduleExports: any
  defaultExport: any
} {
  if (isPrimitive(mod) || Array.isArray(mod) || mod instanceof Promise) {
    return {
      keys: [],
      moduleExports: {},
      defaultExport: mod,
    }
  }

  if (
    interopDefault !== false
    && '__esModule' in mod
    && !isPrimitive(mod.default)
  ) {
    const defaultKets = Object.keys(mod.default)
    const moduleKeys = Object.keys(mod)
    const allKeys = new Set([...defaultKets, ...moduleKeys])
    allKeys.delete('default')
    // the namespace always provides its own synthetic 'module.exports'
    // export, shadowing a real property of that name (Node parity)
    allKeys.delete('module.exports')
    return {
      keys: Array.from(allKeys),
      moduleExports: new Proxy(mod, {
        get(mod, prop) {
          return mod[prop] ?? mod.default?.[prop]
        },
      }),
      defaultExport: mod,
    }
  }

  return {
    keys: Object.keys(mod).filter(
      key => key !== 'default' && key !== 'module.exports',
    ),
    moduleExports: mod,
    defaultExport: mod,
  }
}

function isPrimitive(obj: unknown): boolean {
  const isObject = obj != null && (typeof obj === 'object' || typeof obj === 'function')
  return !isObject
}

export const SyntheticModule: typeof VMSyntheticModule = (vm as any)
  .SyntheticModule
export const SourceTextModule: typeof VMSourceTextModule = (vm as any)
  .SourceTextModule

// `SourceTextModule#hasAsyncGraph` marks the Node 24.9+ vm APIs required to
// load an ES module graph synchronously (`moduleRequests`, `linkRequests`,
// `instantiate`, synchronously-completing `evaluate`) — the same APIs Node
// itself uses for require(esm)
export const supportsSyncEsmEvaluate: boolean
  = typeof (SourceTextModule as any)?.prototype?.hasAsyncGraph === 'function'

let lexerInitialized = false

// Returns true when `source` contains ESM syntax: static import/export
// statements or `import.meta` (dynamic import is allowed in CJS and does not
// count). Returns false when the lexer cannot parse the source at all —
// native ESM would fail on it as well, so the CJS error should surface.
export function hasEsmSyntax(source: string): boolean {
  if (!lexerInitialized) {
    initSync()
    lexerInitialized = true
  }
  try {
    return parse(source)[3]
  }
  catch {
    return false
  }
}

// mirrors Node's require(esm) error codes so user-side catches work uniformly

export function createRequireAsyncModuleError(
  identifier: string,
  detail: string,
): Error {
  const error = new Error(
    `require() cannot be used to load ES Module ${identifier}: ${detail}. Use import() instead.`,
  ) as Error & { code: string }
  error.code = 'ERR_REQUIRE_ASYNC_MODULE'
  return error
}

export function createConcurrentRequireError(identifier: string): Error {
  const error = new Error(
    `Cannot require() ES Module ${identifier} synchronously: it is currently being loaded by a concurrent import(). Await that import before calling require(), or import this module instead of requiring it.`,
  ) as Error & { code: string }
  error.code = 'ERR_REQUIRE_ESM'
  return error
}
