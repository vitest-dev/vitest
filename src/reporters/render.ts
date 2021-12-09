import logUpdate from 'log-update'
import chalk from 'picocolors'
import figures from 'figures'
import indentString from 'indent-string'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import elegantSpinner from 'elegant-spinner'
import logSymbols from 'log-symbols'
import { Task } from '../types'

const pointer = chalk.yellow(figures.pointer)
const skipped = chalk.yellow(figures.arrowDown)

const spinnerMap = new WeakMap<Task, () => string>()
const outputMap = new WeakMap<Task, string>()

const getSymbol = (task: Task) => {
  if (task.mode === 'skip' || task.mode === 'todo')
    return skipped

  // pending
  if (!task.result || task.result.state === 'run') {
    if (task.type === 'suite')
      return pointer
    let spinner = spinnerMap.get(task)
    if (!spinner) {
      spinner = elegantSpinner()
      spinnerMap.set(task, spinner)
    }
    return chalk.yellow(spinner())
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

const renderHelper = (tasks: Task[], level = 0) => {
  let output: string[] = []

  for (const task of tasks) {
    const skipped = task.mode === 'skip' || task.mode === 'todo' ? ` ${chalk.dim('[skipped]')}` : ''

    output.push(indentString(` ${getSymbol(task)} ${task.name}${skipped}`, level, { indent: '  ' }))

    if ((task.result?.state !== 'pass') && outputMap.get(task) != null) {
      let data: string | undefined = outputMap.get(task)

      if (typeof data === 'string') {
        data = stripAnsi(data.trim().split('\n').filter(Boolean).pop()!)
        if (data === '')
          data = undefined
      }

      if (data != null) {
        const out = indentString(`${figures.arrowRight} ${data}`, level, { indent: '  ' })
        output.push(`   ${chalk.gray(cliTruncate(out, process.stdout.columns - 3))}`)
      }
    }

    if ((task.result?.state === 'fail' || !task.result || task.result.state === 'run') && task.type === 'suite' && task.tasks.length > 0)
      output = output.concat(renderHelper(task.tasks, level + 1))
  }

  return output.join('\n')
}

export const createRenderer = (_tasks: Task[]) => {
  let tasks = _tasks
  let timer: any

  function run() {
    const content = renderHelper(tasks)
    logUpdate(content)
  }

  return {
    start() {
      if (timer)
        return this
      timer = setInterval(run, 200)
      return this
    },
    update(_tasks: Task[]) {
      tasks = _tasks
      run()
      return this
    },
    stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      run()
      logUpdate.done()
      return this
    },
  }
}
