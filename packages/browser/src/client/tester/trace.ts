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
  snapshot: unknown
}

// lazily loaded when trace is enabled on runner.ts
declare let __vitest_dom_snapshot__: typeof import('rrweb-snapshot')

// TODO: why global. otherwise build breaks. just for now.
declare let __vitest_selector_engine__: import('ivya').Ivya
declare let __vitest_css_from_element__: (el: Element) => string

// TODO: why global
const browserTraceEntries: Map<string, BrowserTraceEntry[]>
  = ((globalThis as any).__vitest_browser_trace__ ??= new Map())

// TODO: should we avoid accumulating? send snapshot and clear to save memory?
export function recordBrowserTraceEntry(
  task: Task,
  payload: Omit<BrowserTraceEntry, 'timestamp' | 'snapshot'>,
): void {
  // TODO: split entries by
  // task.repeats
  // task.retry
  const entries = browserTraceEntries.get(task.id) || []
  entries.push({
    ...payload,
    selector: payload.selector ? resolveCssSelector(payload.selector) : undefined,
    snapshot: __vitest_dom_snapshot__.snapshot(document),
  })
  browserTraceEntries.set(task.id, entries)
}

// Convert provider-specific locator to css selector for viewer highlight.
// We resolve in the live DOM at collection time (snapshot is taken at the same moment),
// so the CSS selector should point to the same element in the rebuilt snapshot.
// Playwright takes the alternative approach: store the raw selector in the trace,
// then run the selector engine inside the snapshot iframe at view time via injected script.
// That is more faithful but more complex — revisit if CSS path diverges after rrweb rebuild.
function resolveCssSelector(selector: string): string | undefined {
  try {
    const engine = __vitest_selector_engine__
    const parsed = engine.parseSelector(selector)
    const el = engine.querySelector(parsed, document.documentElement, false)
    if (el) {
      return __vitest_css_from_element__(el)
    }
  }
  catch {}
}

export function getBrowserTrace(testId: string): BrowserTraceData | undefined {
  const steps = browserTraceEntries.get(testId)
  browserTraceEntries.delete(testId)
  if (!steps?.length) {
    return
  }
  return { steps }
}
