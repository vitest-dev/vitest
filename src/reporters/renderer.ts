import { basename, dirname, isAbsolute, relative } from 'path'
import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import figures from 'figures'
import indentString from 'indent-string'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import elegantSpinner from 'elegant-spinner'
import logSymbols from 'log-symbols'
import { slash } from '@antfu/utils'
import { SnapshotSummary, Task } from '../types'
import { getNames, getTests } from '../utils'

const DURATION_LONG = 300
const MAX_HEIGHT = 20

const pointer = c.yellow(figures.pointer)
const skipped = c.yellow(figures.arrowDown)

const spinnerMap = new WeakMap<Task, () => string>()
const outputMap = new WeakMap<Task, string>()

const DOWN_ARROW = c.gray('\u21B3 ')
const DOT = c.gray('\u2022 ')

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
    summary.push(`${DOWN_ARROW}${formatTestPath(rootDir, head)}`)

    tail.forEach((key) => {
      summary.push(`  ${DOT}${formatTestPath(rootDir, key)}`)
    })
  }

  if (snapshots.unchecked) {
    if (snapshots.didUpdate)
      summary.push(c.bold(c.green(`${snapshots.unchecked} removed`)))
    else
      summary.push(c.bold(c.yellow(`${snapshots.unchecked} obsolete`)))

    snapshots.uncheckedKeysByFile.forEach((uncheckedFile) => {
      summary.push(`${DOWN_ARROW}${formatTestPath(rootDir, uncheckedFile.filePath)}`)
      uncheckedFile.keys.forEach(key => summary.push(`  ${DOT}${key}`))
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
    return logSymbols.success

  if (task.result.state === 'fail') {
    return task.type === 'suite'
      ? pointer
      : logSymbols.error
  }

  return ' '
}

export function renderTree(tasks: Task[], level = 0) {
  let output: string[] = []

  for (const task of tasks) {
    let delta = 1
    let suffix = (task.mode === 'skip' || task.mode === 'todo') ? ` ${c.dim('[skipped]')}` : ''
    const prefix = ` ${getStateSymbol(task)} `

    if (task.type === 'suite')
      suffix += c.dim(` (${getTests(task).length})`)

    if (task.result?.end) {
      const duration = task.result.end - task.result.start
      if (duration > DURATION_LONG)
        suffix += c.yellow(` ${Math.round(duration)}${c.dim('ms')}`)
    }

    if (task.name)
      output.push(indentString(prefix + task.name + suffix, level, { indent: '  ' }))
    else
      delta = 0

    if ((task.result?.state !== 'pass') && outputMap.get(task) != null) {
      let data: string | undefined = outputMap.get(task)

      if (typeof data === 'string') {
        data = stripAnsi(data.trim().split('\n').filter(Boolean).pop()!)
        if (data === '')
          data = undefined
      }

      if (data != null) {
        const out = indentString(`${figures.arrowRight} ${data}`, level, { indent: '  ' })
        output.push(`   ${c.gray(cliTruncate(out, process.stdout.columns - 3))}`)
      }
    }

    if ((task.result?.state === 'fail' || task.result?.state === 'run') && task.type === 'suite' && task.tasks.length > 0)
      output = output.concat(renderTree(task.tasks, level + delta))
  }

  // TODO: moving windows
  return output.slice(0, MAX_HEIGHT).join('\n')
}

export const createRenderer = (_tasks: Task[]) => {
  let tasks = _tasks
  let timer: any

  const log = createLogUpdate(process.stdout)

  function update() {
    log(renderTree(tasks))
  }

  return {
    start() {
      if (timer)
        return this
      timer = setInterval(update, 200)
      return this
    },
    update(_tasks: Task[]) {
      tasks = _tasks
      update()
      return this
    },
    async stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      log.clear()
      // eslint-disable-next-line no-console
      console.log(renderTree(tasks))
      return this
    },
  }
}

export function getFullName(task: Task) {
  return getNames(task).join(c.gray(' > '))
}
