import type { Suite, Task } from 'vitest'

export function isSuite(task: Task): task is Suite {
  return Object.hasOwnProperty.call(task, 'tasks')
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
  const colors = ['blue', 'yellow', 'cyan', 'green', 'magenta']
  return colors[index % colors.length]
}
