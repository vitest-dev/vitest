import c from 'picocolors'
import type { Task } from '../../../types'
import { getTests } from '../../../utils'
import type { Logger } from '../../logger'

export interface DotRendererOptions {
  logger: Logger
}

interface Icon { char: string; color: (char: string) => string }

const check: Icon = { char: '·', color: c.green }
const cross: Icon = { char: 'x', color: c.red }
const pending: Icon = { char: '*', color: c.yellow }
const skip: Icon = { char: '-', color: (char: string) => c.dim(c.gray(char)) }

function getIcon(task: Task) {
  if (task.mode === 'skip' || task.mode === 'todo')
    return skip
  switch (task.result?.state) {
    case 'pass':
      return check
    case 'fail':
      return cross
    default:
      return pending
  }
}

function render(tasks: Task[], width: number): string {
  const all = getTests(tasks)
  let currentIcon = pending
  let currentTasks = 0
  let previousLineWidth = 0
  let output = ''
  const addOutput = () => {
    const { char, color } = currentIcon
    const availableWidth = width - previousLineWidth
    if (availableWidth > currentTasks) {
      output += color(char.repeat(currentTasks))
      previousLineWidth += currentTasks
    }
    else {
      let buf = `${char.repeat(availableWidth)}\n`
      let remaining = currentTasks - availableWidth
      buf += `${char.repeat(width)}\n`.repeat(Math.floor(remaining / width))
      remaining %= width

      if (remaining > 0) {
        buf += char.repeat(remaining)
        previousLineWidth = remaining
      }
      else {
        previousLineWidth = 0
      }

      output += color(buf)
    }
  }
  for (const task of all) {
    const icon = getIcon(task)
    if (icon === currentIcon) {
      currentTasks++
      continue
    }
    // Task mode/state has changed, add previous group to output
    addOutput()

    // Start tracking new group
    currentTasks = 1
    currentIcon = icon
  }
  addOutput()
  return output
}

export function createDotRenderer(_tasks: Task[], options: DotRendererOptions) {
  let tasks = _tasks
  let timer: any

  const { logUpdate: log, outputStream } = options.logger

  function update() {
    log(render(tasks, outputStream.columns))
  }

  return {
    start() {
      if (timer)
        return this
      timer = setInterval(update, 16)
      return this
    },
    update(_tasks: Task[]) {
      tasks = _tasks
      return this
    },
    async stop() {
      if (timer) {
        clearInterval(timer)
        timer = undefined
      }
      log.clear()
      options.logger.log(render(tasks, outputStream.columns))
      return this
    },
    clear() {
      log.clear()
    },
  }
}
