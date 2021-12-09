import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import figures from 'figures'
import indentString from 'indent-string'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import elegantSpinner from 'elegant-spinner'
import logSymbols from 'log-symbols'
import { Task } from '../types'
import { getTests } from '../utils'

const DURATION_LONG = 300
const MAX_HEIGHT = 20

const pointer = c.yellow(figures.pointer)
const skipped = c.yellow(figures.arrowDown)

const spinnerMap = new WeakMap<Task, () => string>()
const outputMap = new WeakMap<Task, string>()

const getSymbol = (task: Task) => {
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

function renderTree(tasks: Task[], level = 0) {
  let output: string[] = []

  for (const task of tasks) {
    let delta = 1
    let suffix = (task.mode === 'skip' || task.mode === 'todo') ? ` ${c.dim('[skipped]')}` : ''
    const prefix = ` ${getSymbol(task)} `

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
      return new Promise(resolve => setTimeout(resolve, 10))
    },
  }
}
