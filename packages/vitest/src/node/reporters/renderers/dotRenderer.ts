import c from 'picocolors'
import type { Task } from '../../../types'
import { getTests } from '../../../utils'
import type { Logger } from '../../logger'

export interface DotRendererOptions {
  logger: Logger
}

interface Icon {
  char: string
  color: (char: string) => string
}

const check: Icon = { char: '·', color: c.green }
const cross: Icon = { char: 'x', color: c.red }
const pending: Icon = { char: '*', color: c.yellow }
const skip: Icon = { char: '-', color: (char: string) => c.dim(c.gray(char)) }

function getIcon(task: Task) {
  if (task.mode === 'skip' || task.mode === 'todo') {
    return skip
  }
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

  // The log-update uses various ANSI helper utilities, e.g. ansi-warp, ansi-slice,
  // when printing. Passing it hundreds of single characters containing ANSI codes reduces
  // performances. We can optimize it by reducing amount of ANSI codes, e.g. by coloring
  // multiple tasks at once instead of each task separately.
  const addOutput = () => {
    const { char, color } = currentIcon
    const availableWidth = width - previousLineWidth
    if (availableWidth > currentTasks) {
      output += color(char.repeat(currentTasks))
      previousLineWidth += currentTasks
    }
    else {
      // We need to split the line otherwise it will mess up log-update's height calculation
      // and spam the scrollback buffer with dots.

      // Fill the current line first
      let buf = `${char.repeat(availableWidth)}\n`
      const remaining = currentTasks - availableWidth

      // Then fill as many full rows as possible
      const fullRows = Math.floor(remaining / width)
      buf += `${char.repeat(width)}\n`.repeat(fullRows)

      // Add remaining dots which don't make a full row
      const partialRow = remaining % width
      if (partialRow > 0) {
        buf += char.repeat(partialRow)
        previousLineWidth = partialRow
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
  const columns = 'columns' in outputStream ? outputStream.columns : 80

  function update() {
    log(render(tasks, columns))
  }

  return {
    start() {
      if (timer) {
        return this
      }
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
      options.logger.log(render(tasks, columns))
      return this
    },
    clear() {
      log.clear()
    },
  }
}
