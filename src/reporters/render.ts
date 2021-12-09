import logUpdate from 'log-update'
import chalk from 'picocolors'
import figures from 'figures'
import indentString from 'indent-string'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import elegantSpinner from 'elegant-spinner'
import logSymbols from 'log-symbols'

const pointer = chalk.yellow(figures.pointer)
const skipped = chalk.yellow(figures.arrowDown)

interface Task {
  title: string
  isEnabled(): boolean
  isSkipped(): boolean
  isPending(): boolean
  isFailed(): boolean
  isCompleted(): boolean
  hasFailed(): boolean
  subtasks: Task[]
  output: string
  spinner: () => string
}

interface Options {
  showSubtasks: boolean
  collapse: boolean
  clearOutput: boolean
}

const getSymbol = (task: Task, options: Options) => {
  if (!task.spinner)
    task.spinner = elegantSpinner()

  if (task.isPending())
    return options.showSubtasks !== false && task.subtasks.length > 0 ? pointer : chalk.yellow(task.spinner())

  if (task.isCompleted())
    return logSymbols.success

  if (task.hasFailed())
    return task.subtasks.length > 0 ? pointer : logSymbols.error

  if (task.isSkipped())
    return skipped

  return ' '
}

const renderHelper = (tasks: Task[], options: Options, level = 0) => {
  let output: string[] = []

  for (const task of tasks) {
    if (task.isEnabled()) {
      const skipped = task.isSkipped() ? ` ${chalk.dim('[skipped]')}` : ''

      output.push(indentString(` ${getSymbol(task, options)} ${task.title}${skipped}`, level, { indent: '  ' }))

      if ((task.isPending() || task.isSkipped() || task.hasFailed()) && task.output != null) {
        let data: string | undefined = task.output

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

      if ((task.isPending() || task.hasFailed() || options.collapse === false) && (task.hasFailed() || options.showSubtasks !== false) && task.subtasks.length > 0)
        output = output.concat(renderHelper(task.subtasks, options, level + 1))
    }
  }

  return output.join('\n')
}

const render = (tasks: Task[], options: Options) => {
  logUpdate(renderHelper(tasks, options))
}

export class UpdateRenderer {
  id: any

  constructor(public tasks: Task[], public options: Options) {
    Object.assign(options, {
      showSubtasks: true,
      collapse: true,
      clearOutput: false,
    }, options)
  }

  render() {
    if (this.id) {
      // Do not render if we are already rendering
      return
    }

    this.id = setInterval(() => {
      render(this.tasks, this.options)
    }, 100)
  }

  end(err: unknown) {
    if (this.id) {
      clearInterval(this.id)
      this.id = undefined
    }

    render(this.tasks, this.options)

    if (this.options.clearOutput && err === undefined)
      logUpdate.clear()
    else
      logUpdate.done()
  }
}
