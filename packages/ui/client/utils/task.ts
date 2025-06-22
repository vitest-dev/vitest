import type { RunnerTask, RunnerTestSuite } from 'vitest'

export function isSuite(task: RunnerTask): task is RunnerTestSuite {
  return Object.hasOwnProperty.call(task, 'tasks')
}

export function isTaskDone(task: RunnerTask) {
  const state = task.result?.state
  const mode = task.mode

  return state === 'pass' || state === 'fail' || state === 'skip' || mode === 'skip' || mode === 'todo'
}

export function caseInsensitiveMatch(target: string, str2: string) {
  if (typeof target !== 'string' || typeof str2 !== 'string') {
    return false
  }
  return target.toLowerCase().includes(str2.toLowerCase())
}

export function getProjectNameColor(name: string | undefined) {
  if (!name) {
    return ''
  }
  const index = name
    .split('')
    .reduce((acc, v, idx) => acc + v.charCodeAt(0) + idx, 0)
  const colors = ['yellow', 'cyan', 'green', 'magenta']
  return colors[index % colors.length]
}

export function getProjectTextColor(color: string) {
  switch (color) {
    case 'blue':
    case 'green':
    case 'magenta':
    case 'black':
    case 'red':
      return 'white'

    case 'yellow':
    case 'cyan':
    case 'white':
    default:
      return 'black'
  }
}
