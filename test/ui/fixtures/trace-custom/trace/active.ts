import type { TraceRecorder } from './recorder'

let activeTraceRecorder: TraceRecorder | undefined

export function setActiveTraceRecorder(recorder: TraceRecorder): void {
  activeTraceRecorder = recorder
}

export function clearActiveTraceRecorder(recorder: TraceRecorder): void {
  if (activeTraceRecorder === recorder) {
    activeTraceRecorder = undefined
  }
}

export function getActiveTraceRecorder(): TraceRecorder {
  if (!activeTraceRecorder) {
    throw new Error('Trace expect was used outside of a traced test')
  }
  return activeTraceRecorder
}
