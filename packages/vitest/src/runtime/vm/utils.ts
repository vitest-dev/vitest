import type { VMSourceTextModule, VMSyntheticModule } from './types'
import vm from 'node:vm'

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
    keys: Object.keys(mod).filter(key => key !== 'default'),
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

// Node never collects a vm context in which multiple scripts installed
// closures, and `vm.SourceTextModule`s are pinned by the realm's base object
// list: the ContextifyContext/ModuleWrap wrappers keep the whole context
// reachable even through forced full GCs, so a long-lived vm worker
// accumulates every test file's world until it hits `vmMemoryLimit` and gets
// recycled, destroying the worker's compile caches with it. Clearing what the
// test file added to the global object (and the DOM) caps what a pinned
// context retains. Pristine globals are kept so that work queued before the
// teardown (jsdom events, worker-scoped fixture cleanups) can still run.
const captureKeysScript = new vm.Script(
  `Object.getOwnPropertyNames(globalThis).concat(Object.getOwnPropertySymbols(globalThis))`,
  { filename: 'virtual:vitest-capture-context-keys.js' },
)

export function captureContextKeys(context: vm.Context): Set<string | symbol> {
  try {
    return new Set(captureKeysScript.runInContext(context))
  }
  catch {
    return new Set()
  }
}

const stripScript = new vm.Script(
  `(initialKeys) => {
  const g = globalThis
  try { g.document.body.textContent = '' } catch {}
  try { g.document.head.textContent = '' } catch {}
  let keys = []
  try { keys = Object.getOwnPropertyNames(g).concat(Object.getOwnPropertySymbols(g)) } catch {}
  for (const key of keys) {
    if (initialKeys.has(key)) continue
    try { delete g[key] } catch {}
  }
}`,
  { filename: 'virtual:vitest-strip-context.js' },
)

export function stripDisposedContext(context: vm.Context, initialKeys: Set<string | symbol>): void {
  try {
    stripScript.runInContext(context)(initialKeys)
  }
  catch {
    // the context is being thrown away; stripping is best-effort
  }
}
