import type { Suite, Task } from 'vitest'

export function isSuite(task: Task): task is Suite {
  return Object.hasOwnProperty.call(task, 'tasks')
}

export function caseInsensitiveMatch(target: string, str2: string) {
  if (typeof target !== 'string' || typeof str2 !== 'string')
    return false
  return target.toLowerCase().includes(str2.toLowerCase())
}
