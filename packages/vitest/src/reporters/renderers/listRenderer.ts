import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import cliTruncate from 'cli-truncate'
import stripAnsi from 'strip-ansi'
import type { Task } from '../../types'
import { getTests } from '../../utils'
import { F_RIGHT } from './figures'
import { getCols, getStateSymbol } from './utils'

export interface ListRendererOptions {
  renderSucceed?: boolean
  outputStream: NodeJS.WritableStream
}

const DURATION_LONG = 300

const outputMap = new WeakMap<Task, string>()

function formatFilepath(path: string) {
  const lastSlash = Math.max(path.lastIndexOf('/') + 1, 0)
  const basename = path.slice(lastSlash)
  let firstDot = basename.indexOf('.')
  if (firstDot < 0)
    firstDot = basename.length
  firstDot += lastSlash

  return c.dim(path.slice(0, lastSlash)) + path.slice(lastSlash, firstDot) + c.dim(path.slice(firstDot))
}

export function renderTree(tasks: Task[], options: ListRendererOptions, level = 0) {
  let output: string[] = []

  for (const task of tasks) {
    let suffix = ''
    const prefix = ` ${getStateSymbol(task)} `

    if (task.type === 'suite')
      suffix += c.dim(` (${getTests(task).length})`)

    if (task.mode === 'skip' || task.mode === 'todo')
      suffix += ` ${c.dim(c.gray('[skipped]'))}`

    if (task.result?.duration != null) {
      if (task.result.duration > DURATION_LONG)
        suffix += c.yellow(` ${Math.round(task.result.duration)}${c.dim('ms')}`)
    }

    let name = task.name
    if (level === 0)
      name = formatFilepath(name)
    output.push('  '.repeat(level) + prefix + name + suffix)

    if ((task.result?.state !== 'pass') && outputMap.get(task) != null) {
      let data: string | undefined = outputMap.get(task)

      if (typeof data === 'string') {
        data = stripAnsi(data.trim().split('\n').filter(Boolean).pop()!)
        if (data === '')
          data = undefined
      }

      if (data != null) {
        const out = `${'  '.repeat(level)}${F_RIGHT} ${data}`
        output.push(`   ${c.gray(cliTruncate(out, getCols(-3)))}`)
      }
    }
    if (task.type === 'suite' && task.tasks.length > 0) {
      if ((task.result?.state === 'fail' || task.result?.state === 'run' || options.renderSucceed))
        output = output.concat(renderTree(task.tasks, options, level + 1))
    }
  }

  // TODO: moving windows
  return output.join('\n')
}

export const createListRenderer = (_tasks: Task[], options: ListRendererOptions) => {
  let tasks = _tasks
  let timer: any

  const log = createLogUpdate(options.outputStream)

  function update() {
    log(renderTree(tasks, options))
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
      options.outputStream.write(`${renderTree(tasks, options)}\n`)
      return this
    },
    clear() {
      log.clear()
    },
  }
}
