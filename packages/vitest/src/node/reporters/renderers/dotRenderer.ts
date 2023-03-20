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

function render(tasks: Task[]): string {
  const all = getTests(tasks)
  const output: string[] = []

  // The log-update uses various ANSI helper utilities, e.g. ansi-warp, ansi-slice,
  // when printing. Passing it hundreds of single characters containing ANSI codes reduces
  // performances. We can optimize it by reducing amount of ANSI codes, e.g. by coloring
  // multiple tasks at once instead of each task separately.
  let currentIcon = pending
  let currentTasks = 0

  const addOutput = () => output.push(currentIcon.color(currentIcon.char.repeat(currentTasks)))

  for (const task of all) {
    const icon = getIcon(task)
    const isLast = all.indexOf(task) === all.length - 1

    if (icon === currentIcon) {
      currentTasks++

      if (isLast)
        addOutput()

      continue
    }

    // Task mode/state has changed, add previous group to output
    addOutput()

    // Start tracking new group
    currentTasks = 1
    currentIcon = icon

    if (isLast)
      addOutput()
  }

  return output.join('')
}

export const createDotRenderer = (_tasks: Task[], options: DotRendererOptions) => {
  let tasks = _tasks
  let timer: any

  const log = options.logger.logUpdate

  function update() {
    log(render(tasks))
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
      options.logger.log(render(tasks))
      return this
    },
    clear() {
      log.clear()
    },
  }
}
