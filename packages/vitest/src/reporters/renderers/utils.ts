import { basename, dirname, isAbsolute, relative } from 'pathe'
import c from 'picocolors'
import stripAnsi from 'strip-ansi'
import type { SnapshotSummary, Task } from '../../types'
import { slash } from '../../utils'
import { F_CHECK, F_CROSS, F_DOT, F_DOWN, F_DOWN_RIGHT, F_LONG_DASH, F_POINTER } from './figures'

export const spinnerMap = new WeakMap<Task, () => string>()
export const pointer = c.yellow(F_POINTER)
export const skipped = c.dim(c.gray(F_DOWN))

export function getCols(delta = 0) {
  let length = process.stdout.columns
  if (!length || isNaN(length))
    length = 30
  return Math.max(length + delta, 0)
}

export function divider(text?: string, left?: number, right?: number) {
  const cols = getCols()

  if (text) {
    const textLength = stripAnsi(text).length
    if (left == null && right != null) {
      left = cols - textLength - right
    }
    else {
      left = left ?? Math.floor((cols - textLength) / 2)
      right = cols - textLength - left
    }
    left = Math.max(0, left)
    right = Math.max(0, right)
    return `${F_LONG_DASH.repeat(left)}${text}${F_LONG_DASH.repeat(right)}`
  }
  return F_LONG_DASH.repeat(cols)
}

export function formatTestPath(root: string, path: string) {
  if (isAbsolute(path))
    path = relative(root, path)

  const dir = dirname(path)
  const ext = path.match(/(\.(spec|test)\.[cm]?[tj]sx?)$/)?.[0] || ''
  const base = basename(path, ext)

  return slash(c.dim(`${dir}/`) + c.bold(base)) + c.dim(ext)
}

export function renderSnapshotSummary(rootDir: string, snapshots: SnapshotSummary) {
  const summary: string[] = []

  if (snapshots.added)
    summary.push(c.bold(c.green(`${snapshots.added} written`)))
  if (snapshots.unmatched)
    summary.push(c.bold(c.red(`${snapshots.unmatched} failed`)))
  if (snapshots.updated)
    summary.push(c.bold(c.green(`${snapshots.updated} updated `)))

  if (snapshots.filesRemoved) {
    if (snapshots.didUpdate)
      summary.push(c.bold(c.green(`${snapshots.filesRemoved} files removed `)))

    else
      summary.push(c.bold(c.yellow(`${snapshots.filesRemoved} files obsolete `)))
  }

  if (snapshots.filesRemovedList && snapshots.filesRemovedList.length) {
    const [head, ...tail] = snapshots.filesRemovedList
    summary.push(`${c.gray(F_DOWN_RIGHT)} ${formatTestPath(rootDir, head)}`)

    tail.forEach((key) => {
      summary.push(`  ${c.gray(F_DOT)} ${formatTestPath(rootDir, key)}`)
    })
  }

  if (snapshots.unchecked) {
    if (snapshots.didUpdate)
      summary.push(c.bold(c.green(`${snapshots.unchecked} removed`)))

    else
      summary.push(c.bold(c.yellow(`${snapshots.unchecked} obsolete`)))

    snapshots.uncheckedKeysByFile.forEach((uncheckedFile) => {
      summary.push(`${c.gray(F_DOWN_RIGHT)} ${formatTestPath(rootDir, uncheckedFile.filePath)}`)
      uncheckedFile.keys.forEach(key => summary.push(`  ${c.gray(F_DOT)} ${key}`))
    })
  }

  return summary
}

export function getStateString(tasks: Task[], name = 'tests') {
  if (tasks.length === 0)
    return c.dim(`no ${name}`)

  const passed = tasks.filter(i => i.result?.state === 'pass')
  const failed = tasks.filter(i => i.result?.state === 'fail')
  const skipped = tasks.filter(i => i.mode === 'skip')
  const todo = tasks.filter(i => i.mode === 'todo')

  return [
    failed.length ? c.bold(c.red(`${failed.length} failed`)) : null,
    passed.length ? c.bold(c.green(`${passed.length} passed`)) : null,
    skipped.length ? c.yellow(`${skipped.length} skipped`) : null,
    todo.length ? c.gray(`${todo.length} todo`) : null,
  ].filter(Boolean).join(c.dim(' | ')) + c.gray(` (${tasks.length})`)
}

export function getStateSymbol(task: Task) {
  if (task.mode === 'skip' || task.mode === 'todo')
    return skipped

  if (!task.result)
    return c.gray('·')

  // pending
  if (task.result.state === 'run') {
    if (task.type === 'suite')
      return pointer
    let spinner = spinnerMap.get(task)
    if (!spinner) {
      spinner = elegantSpinner()
      spinnerMap.set(task, spinner)
    }
    return c.yellow(spinner())
  }

  if (task.result.state === 'pass')
    return c.green(F_CHECK)

  if (task.result.state === 'fail') {
    return task.type === 'suite'
      ? pointer
      : c.red(F_CROSS)
  }

  return ' '
}

export const spinnerFrames = process.platform === 'win32'
  ? ['-', '\\', '|', '/']
  : ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function elegantSpinner() {
  let index = 0

  return () => {
    index = ++index % spinnerFrames.length
    return spinnerFrames[index]
  }
}
