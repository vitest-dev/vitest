import type { Suite, Task } from 'vitest'

export function isSuite(task: Task): task is Suite {
  return Object.hasOwnProperty.call(task, 'tasks')
}

export function caseInsensitiveMatch(target: string, str2: string) {
  if (typeof target !== 'string' || typeof str2 !== 'string')
    return false
  return target.toLowerCase().includes(str2.toLowerCase())
}

export function getProjectNameColor(name: string | undefined, isDark: boolean) {
  if (!name)
    return ''
  const index = name.split('').reduce((acc, v, idx) => acc + v.charCodeAt(0) + idx, 0)
  const darkColors = [
    '#0000FF', // blue
    '#FFFF00', // yellow
    '#00FFFF', // cyan
    '#00FF00', // green
    '#FF00FF', // magenta
  ]
  const lightColors = [
    '#330099', // blue
    '#7c7c05', // yellow
    '#087b7b', // cyan
    '#025402', // green
    '#FF00FF', // magenta
  ]
  return isDark ? darkColors[index % darkColors.length] : lightColors[index % lightColors.length]
}
