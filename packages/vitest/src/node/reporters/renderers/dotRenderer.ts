import c from 'picocolors'
import type { Task } from '../../../types'
import { clearInterval, getTests, setInterval } from '../../../utils'
import type { Logger } from '../../logger'

export interface DotRendererOptions {
  logger: Logger
}

const check = c.green('·')
const cross = c.red('x')
const pending = c.yellow('*')
const skip = c.dim(c.gray('-'))

function render(tasks: Task[]) {
  const all = getTests(tasks)
  return all.map((i) => {
    if (i.mode === 'skip' || i.mode === 'todo')
      return skip
    switch (i.result?.state) {
      case 'pass':
        return check
      case 'fail':
        return cross
      default:
        return pending
    }
  }).join('')
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
      options.logger.log(render(tasks))
      return this
    },
    clear() {
      log.clear()
    },
  }
}
