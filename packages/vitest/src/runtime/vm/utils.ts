import type { VMModule, VMSourceTextModule, VMSyntheticModule } from './types'
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
  = typeof SourceTextModule?.prototype.hasAsyncGraph === 'function'

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
  const error: NodeJS.ErrnoException = new Error(
    `require() cannot be used to load ES Module ${identifier}: ${detail}. Use import() instead.`,
  )
  error.code = 'ERR_REQUIRE_ASYNC_MODULE'
  return error
}

export function createConcurrentRequireError(identifier: string): Error {
  const error: NodeJS.ErrnoException = new Error(
    `Cannot require() ES Module ${identifier} synchronously: it is currently being loaded by a concurrent import(). Await that import before calling require(), or import this module instead of requiring it.`,
  )
  error.code = 'ERR_REQUIRE_ESM'
  return error
}

// The active executor of this worker: vm pools run one test file (and so
// one executor) at a time, which lets script-level dynamic import callbacks
// be static functions instead of per-executor closures. Node registers the
// callback for the lifetime of the compiled script, so a closure would both
// pin the executor's test file world and make compiled scripts unshareable
// between contexts.
interface ActiveVmExecutor {
  importModuleDynamically: (specifier: string, referencer: VMModule) => Promise<VMModule>
}

let activeVmExecutor: ActiveVmExecutor | undefined

export function setActiveVmExecutor(executor: ActiveVmExecutor | undefined): void {
  activeVmExecutor = executor
}

export async function activeImportModuleDynamically(specifier: string, referencer: VMModule): Promise<VMModule> {
  if (!activeVmExecutor) {
    throw new Error(`Cannot import "${specifier}": the test context was torn down.`)
  }
  return activeVmExecutor.importModuleDynamically(specifier, referencer)
}

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
