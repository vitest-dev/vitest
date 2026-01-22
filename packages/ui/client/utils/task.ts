import type { RunnerTask, RunnerTestSuite } from 'vitest'
import { isDark } from '~/composables'

export function isSuite(task: RunnerTask): task is RunnerTestSuite {
  return Object.hasOwn(task, 'tasks')
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

export function formatTime(time: number): string {
  if (time > 1000) {
    return `${(time / 1000).toFixed(2)}s`
  }
  return `${Math.round(time)}ms`
}

export function formatPreciseTime(time: number): string {
  if (time > 1000) {
    return `${(time / 1000).toFixed(2)}s`
  }
  return `${time.toFixed(2)}ms`
}

export interface ModuleLabelItem {
  id: string
  raw: string
  splits: string[]
  readonly splitted: string[]
  candidate: string
  finished: boolean
}

export function calcExternalLabels(
  labels: ModuleLabelItem[],
): Map<string, string> {
  const result: Map<string, string> = new Map()
  const splitMap: Map<string, number[]> = new Map()
  const firsts: number[] = []
  while (true) {
    let finishedCount = 0
    labels.forEach((label, i) => {
      const { splits, finished } = label
      // record the candidate as final label text when label is marked finished
      if (finished) {
        finishedCount++
        const { raw, candidate } = label
        result.set(raw, candidate)
        return
      }
      if (splits.length === 0) {
        label.finished = true
        return
      }
      const head = splits[0]
      if (splitMap.has(head)) {
        label.candidate += label.candidate === '' ? head : `/${head}`
        splitMap.get(head)?.push(i)
        splits.shift()
      }
      else {
        splitMap.set(head, [i])
        // record the index of the label where the head first appears
        firsts.push(i)
      }
    })
    // update candidate of label which index appears in first array
    firsts.forEach((i) => {
      const label = labels[i]
      const head = label.splits.shift()
      label.candidate += label.candidate === '' ? head : `/${head}`
    })
    splitMap.forEach((value) => {
      if (value.length === 1) {
        const index = value[0]
        labels[index].finished = true
      }
    })
    splitMap.clear()
    firsts.length = 0
    if (finishedCount === labels.length) {
      break
    }
  }
  return result
}

export function createModuleLabelItem(module: string): ModuleLabelItem {
  let raw = module
  if (raw.includes('/node_modules/')) {
    raw = module.split(/\/node_modules\//g).pop()!
  }
  const splits = raw.split(/\//g)
  return {
    raw,
    splits,
    splitted: [...splits],
    candidate: '',
    finished: false,
    id: module,
  }
}

export function getExternalModuleName(module: string) {
  const label = createModuleLabelItem(module)
  return label.raw
}

export function getImportDurationType(duration: number) {
  if (duration >= 500) {
    return 'danger'
  }
  if (duration >= 100) {
    return 'warning'
  }
}

export function getDurationClass(duration: number) {
  const type = getImportDurationType(duration)
  if (type === 'danger') {
    return 'text-red'
  }
  if (type === 'warning') {
    return 'text-orange'
  }
}

export function getBadgeNameColor(name: string | undefined, transparent = false) {
  if (!name) {
    return ''
  }
  const index = name
    .split('')
    .reduce((acc, v, idx) => acc + v.charCodeAt(0) + idx, 0)
  const colors = isDark.value
    ? ['yellow', 'cyan', '#006800', 'magenta']
    : ['#ff5400', '#02a4a4', 'green', 'magenta']
  const transparentColors = isDark.value
    ? ['#ffff0091', '#0ff6', '#5dbb5dc9', '#ff00ff80']
    : ['#ff540091', '#00828266', '#5dbb5dc9', '#ff00ff80']
  return (transparent ? transparentColors : colors)[index % colors.length]
}

export function getBadgeTextColor(color: string) {
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
