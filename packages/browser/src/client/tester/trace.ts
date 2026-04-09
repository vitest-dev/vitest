import type { Task } from '@vitest/runner'

// TODO: review slop (NEVER REMOVE COMMENT)

// TODO: design trace format
export interface BrowserTraceData {
  steps: BrowserTraceEntry[]
}

export interface BrowserTraceEntry {
  name: string
  // TODO: resolve location (need to go server? no just do all on final record time.)
  stack?: string
  selector?: string
  snapshot: TraceSnapshot
}

interface TraceSnapshot {
  serialized: unknown
  selectorId?: number
}

// lazily loaded when trace is enabled on runner.ts
declare let __vitest_dom_snapshot__: typeof import('rrweb-snapshot')

// TODO: why global. otherwise build breaks. just for now.
declare let __vitest_selector_engine__: import('ivya').Ivya

// TODO: why global
const browserTraceEntries: Map<string, BrowserTraceEntry[]>
  = ((globalThis as any).__vitest_browser_trace__ ??= new Map())

// TODO: should we avoid accumulating? send snapshot and clear to save memory?
export function recordBrowserTraceEntry(
  task: Task,
  options: Omit<BrowserTraceEntry, 'snapshot'>,
): void {
  // TODO: split entries by
  // task.repeats
  // task.retry
  const snapshot = takeSnapshot(options.selector)
  const entry: BrowserTraceEntry = { ...options, snapshot }
  const entries = browserTraceEntries.get(task.id) || []
  entries.push(entry)
  browserTraceEntries.set(task.id, entries)
}

// Resolve ivya selector to a DOM element and take a snapshot with rrweb Mirror
// so we can store the nodeId for provider-agnostic element highlighting in the viewer.
// Note: Playwright's alternative approach is to store the raw selector and run the
// selector engine inside the snapshot iframe at view time via injected script.
// Our approach resolves at collection time (same moment as snapshot) — simpler but
// requires Mirror plumbing. nodeId-based lookup also works across shadow DOM, unlike querySelector.
function takeSnapshot(selector?: string): TraceSnapshot {
  const { snapshot, createMirror } = __vitest_dom_snapshot__
  const mirror = createMirror()
  const serialized = snapshot(document, { mirror })
  if (selector) {
    try {
      const engine = __vitest_selector_engine__
      const el = engine.querySelector(
        engine.parseSelector(selector),
        document.documentElement,
        false,
      )
      if (el) {
        const id = mirror.getId(el)
        if (id !== -1) {
          return { serialized, selectorId: id }
        }
      }
    }
    catch {}
  }
  return { serialized }
}

export function getBrowserTrace(testId: string): BrowserTraceData | undefined {
  const steps = browserTraceEntries.get(testId)
  browserTraceEntries.delete(testId)
  if (!steps?.length) {
    return
  }
  return { steps }
}
