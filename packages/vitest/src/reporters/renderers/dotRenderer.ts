import { createLogUpdate } from 'log-update'
import c from 'picocolors'
import type { Task } from '../../types'
import { getTests } from '../../utils'

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

export const createDotRenderer = (_tasks: Task[]) => {
  let tasks = _tasks
  let timer: any

  const stdout = process.stdout

  const log = createLogUpdate(stdout)

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
      stdout.write(`${render(tasks)}\n`)
      return this
    },
    clear() {
      log.clear()
    },
  }
}
