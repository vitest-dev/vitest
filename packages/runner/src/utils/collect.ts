import { processError } from '@vitest/utils/error'
import type { Suite, TaskBase } from '../types'

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
export function interpretTaskModes(suite: Suite, namePattern?: string | RegExp, onlyMode?: boolean, parentIsOnly?: boolean, allowOnly?: boolean) {
  const suiteIsOnly = parentIsOnly || suite.mode === 'only'

  suite.tasks.forEach((t) => {
    // Check if either the parent suite or the task itself are marked as included
    const includeTask = suiteIsOnly || t.mode === 'only'
    if (onlyMode) {
      if (t.type === 'suite' && (includeTask || someTasksAreOnly(t))) {
        // Don't skip this suite
        if (t.mode === 'only') {
          checkAllowOnly(t, allowOnly)
          t.mode = 'run'
        }
      }
      else if (t.mode === 'run' && !includeTask) {
        t.mode = 'skip'
      }
      else if (t.mode === 'only') {
        checkAllowOnly(t, allowOnly)
        t.mode = 'run'
      }
    }
    if (t.type === 'test') {
      if (namePattern && !getTaskFullName(t).match(namePattern))
        t.mode = 'skip'
    }
    else if (t.type === 'suite') {
      if (t.mode === 'skip')
        skipAllTasks(t)
      else
        interpretTaskModes(t, namePattern, onlyMode, includeTask, allowOnly)
    }
  })

  // if all subtasks are skipped, mark as skip
  if (suite.mode === 'run') {
    if (suite.tasks.length && suite.tasks.every(i => i.mode !== 'run'))
      suite.mode = 'skip'
  }
}

function getTaskFullName(task: TaskBase): string {
  return `${task.suite ? `${getTaskFullName(task.suite)} ` : ''}${task.name}`
}

export function someTasksAreOnly(suite: Suite): boolean {
  return suite.tasks.some(t => t.mode === 'only' || (t.type === 'suite' && someTasksAreOnly(t)))
}

function skipAllTasks(suite: Suite) {
  suite.tasks.forEach((t) => {
    if (t.mode === 'run') {
      t.mode = 'skip'
      if (t.type === 'suite')
        skipAllTasks(t)
    }
  })
}

function checkAllowOnly(task: TaskBase, allowOnly?: boolean) {
  if (allowOnly)
    return
  const error = processError(new Error('[Vitest] Unexpected .only modifier. Remove it or pass --allowOnly argument to bypass this error'))
  task.result = {
    state: 'fail',
    errors: [error],
  }
}

export function generateHash(str: string): string {
  let hash = 0
  if (str.length === 0)
    return `${hash}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `${hash}`
}

export function calculateSuiteHash(parent: Suite) {
  parent.tasks.forEach((t, idx) => {
    t.id = `${parent.id}_${idx}`
    if (t.type === 'suite')
      calculateSuiteHash(t)
  })
}
