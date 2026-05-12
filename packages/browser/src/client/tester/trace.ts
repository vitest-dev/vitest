import type { Task } from '@vitest/runner'
import type { BrowserTraceEntryKind } from 'vitest/browser'
import type { BrowserRPC } from '../client'
import type { SerializedLocator } from './locators'
import { getBrowserState, getWorkerState, now } from '../utils'

export interface BrowserTraceData {
  retry: number
  repeats: number
  // UI has access to original config but let artifact own this
  recordCanvas: boolean
  // Each artifact currently carries one entry; the UI merges entries by attempt.
  // TODO: revisit whether this should be modeled as a single entry.
  entries: BrowserTraceEntry[]
}

export type BrowserTraceEntryStatus = 'pass' | 'fail'
export type BrowserTraceEntryRangePhase = 'start' | 'end'
export type BrowserTraceSelectorResolution = 'matched' | 'missing' | 'error'

export interface BrowserTraceEntryRange {
  id: string
  phase: BrowserTraceEntryRangePhase
}

export interface BrowserTraceEntry {
  name: string
  kind: BrowserTraceEntryKind
  range?: BrowserTraceEntryRange
  status?: BrowserTraceEntryStatus
  startTime: number
  // Derived on UI side from range start/end entries.
  duration?: number
  stack?: string
  // resolved server-side from stack in __vitest_recordBrowserTrace command
  location?: { file: string; line: number; column: number }
  element?: SerializedLocator
  snapshot: TraceSnapshot
}

interface TraceSnapshot {
  serialized: unknown
  viewport: {
    width: number
    height: number
  }
  scroll: {
    x: number
    y: number
  }
  selectorId?: number
  // not used yet for UI but tested
  selectorResolution?: BrowserTraceSelectorResolution
  selectorError?: string
  pseudoClassIds: Record<PseudoClassName, number[]>
}

// rrweb-snapshot rewrites pseudo-class selectors in serialized styles so replay can
// reproduce snapshot-time states. For example:
//   some-selector:hover { ... }
// becomes:
//   some-selector:hover, some-selector.\:hover { ... }
// Vitest side integration then adds matching pseudo-state classes in the replay DOM.
// rrweb-snapshot only handles `:hover` upstream, so we patch it locally for the
// other user-action pseudo-classes as well.
// https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/Pseudo-classes#user_action_pseudo-classes
const PSEUDO_CLASS_NAMES = [
  ':hover',
  ':active',
  ':focus',
  ':focus-visible',
  ':focus-within',
] as const
type PseudoClassName = (typeof PSEUDO_CLASS_NAMES)[number]

export interface BrowserTraceAttempt {
  retry: number
  repeats: number
  startTime: number
}

export function createBrowserTraceRangeId(): string {
  return Math.random().toString(36).slice(2)
}

export async function recordBrowserTraceEntry(
  task: Task,
  options: Omit<BrowserTraceEntry, 'snapshot' | 'startTime'>,
): Promise<void> {
  const attemptInfo = getBrowserState().browserTraceAttempts.get(task.id)!
  const relativeStartTime = now() - attemptInfo.startTime
  const snapshot = takeSnapshot(options.element)
  const entry: BrowserTraceEntry = {
    ...options,
    startTime: relativeStartTime,
    snapshot,
  }
  const { retry, repeats } = attemptInfo
  const { recordCanvas } = getBrowserState().config.browser.traceView

  // An async lane could defer artifact recording and flush it at test-attempt end,
  // but the synchronous snapshot work is already a comparable cost, and this path
  // is mostly data passing after that.
  // Keep it simple unless measurements show artifact recording is a bottleneck.
  const data: BrowserTraceData = {
    retry,
    repeats,
    recordCanvas,
    entries: [entry],
  }
  const rpc = getWorkerState().rpc as any as BrowserRPC
  await rpc.triggerCommand<void>(
    getBrowserState().sessionId,
    '__vitest_recordBrowserTrace',
    undefined,
    [{ testId: task.id, data }],
  )
}

// Resolve ivya selector to a DOM element and take a snapshot with rrweb Mirror
// so we can store the nodeId for provider-agnostic element highlighting in the viewer.
// Note: Playwright's alternative approach is to store the raw selector and run the
// selector engine inside the snapshot iframe at view time via injected script.
// Our approach resolves at collection time (same moment as snapshot) — simpler but
// requires Mirror plumbing. nodeId-based lookup also works across shadow DOM, unlike querySelector.
function takeSnapshot(serializedLocator?: SerializedLocator): TraceSnapshot {
  const { snapshot, createMirror } = getBrowserState().browserTraceDomSnapshot!
  const traceView = getBrowserState().config.browser.traceView
  const engine = getBrowserState().selectorEngine!
  const mirror = createMirror()
  const serialized = snapshot(document, {
    mirror,
    inlineImages: traceView.inlineImages,
    recordCanvas: traceView.recordCanvas,
  })
  const result: TraceSnapshot = {
    serialized,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scroll: {
      x: window.scrollX,
      y: window.scrollY,
    },
    pseudoClassIds: {} as any,
  }
  for (const className of PSEUDO_CLASS_NAMES) {
    const elements = document.querySelectorAll(className)
    const ids = Array.from(elements, el => mirror.getId(el)).filter(id => id !== -1)
    result.pseudoClassIds[className] = ids
  }
  if (serializedLocator) {
    try {
      const el = engine.querySelector(
        engine.parseSelector(serializedLocator._pwSelector ?? serializedLocator.selector),
        document.documentElement,
        false,
      )
      if (!el) {
        result.selectorResolution = 'missing'
      }
      else {
        const id = mirror.getId(el)
        if (id !== -1) {
          result.selectorId = id
          result.selectorResolution = 'matched'
        }
        else {
          result.selectorResolution = 'missing'
        }
      }
    }
    catch (error) {
      result.selectorResolution = 'error'
      result.selectorError = error instanceof Error ? error.message : String(error)
    }
  }
  return result
}
