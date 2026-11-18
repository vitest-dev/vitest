import type { TaskPopulated, Test } from './types'
import { NeverReachedError } from './errors'
import { isShrinkSearchRun } from './test-state'

interface SometimesLabel {
  wasTrue: boolean
  // the first call, for the location of the error
  source?: Error
}

const testLabels = new WeakMap<TaskPopulated, Map<string, SometimesLabel>>()

// only tests with repeats check their labels
export function startSometimesCheck(test: Test): void {
  testLabels.set(test, new Map())
}

export function recordSometimes(test: TaskPopulated, condition: boolean, label: string): void {
  const labels = testLabels.get(test)
  // the hidden runs of a failed seed are not reported, so their values do not count
  if (!labels || isShrinkSearchRun(test)) {
    return
  }
  const state = labels.get(label)
  if (!state) {
    labels.set(
      label,
      condition ? { wasTrue: true } : { wasTrue: false, source: new Error('STACK_TRACE_ERROR') },
    )
  } else if (condition && !state.wasTrue) {
    state.wasTrue = true
    state.source = undefined
  }
}

export function finishSometimesCheck(test: Test, seeds: number): NeverReachedError[] {
  const labels = testLabels.get(test)
  testLabels.delete(test)
  if (!labels || !seeds) {
    return []
  }
  const errors: NeverReachedError[] = []
  for (const [label, { wasTrue, source }] of labels) {
    if (wasTrue) {
      continue
    }
    const message = `expect.sometimes() was never true for ${JSON.stringify(label)} with ${seeds} ${seeds === 1 ? 'seed' : 'seeds'}`
    const error = new NeverReachedError(message)
    if (source?.stack) {
      error.stack = source.stack.replace(
        'Error: STACK_TRACE_ERROR',
        () => `${error.name}: ${error.message}`,
      )
    }
    errors.push(error)
  }
  return errors
}
