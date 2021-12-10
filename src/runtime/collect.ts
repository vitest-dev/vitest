import { basename } from 'path'
import { performance } from 'perf_hooks'
import { nanoid } from 'nanoid'
import { File, Suite, Test } from '../types'
import { interpretOnlyMode } from '../utils'
import { clearContext, createSuiteHooks, defaultSuite } from './suite'
import { context } from './context'
import { setHooks } from './map'
import { processError } from './error'

export async function collectTests(paths: string[]) {
  const files: File[] = []

  for (const filepath of paths) {
    const file: File = {
      id: nanoid(),
      name: basename(filepath),
      type: 'suite',
      mode: 'run',
      computeMode: 'serial',
      filepath,
      tasks: [],
      suite: {} as Suite,
    }

    setHooks(file, createSuiteHooks())

    clearContext()
    try {
      await import(filepath)

      for (const c of [defaultSuite, ...context.tasks]) {
        if (c.type === 'test') {
          file.tasks.push(c)
        }
        else {
          const suite = await c.collect(file)
          if (suite.name || suite.tasks.length)
            file.tasks.push(suite)
        }
      }
    }
    catch (e) {
      file.result = {
        start: performance.now(),
        state: 'fail',
        error: processError(e),
      }
      process.exitCode = 1
    }

    files.push(file)
  }

  const tasks = files.reduce((tasks, file) => tasks.concat(file.tasks), [] as (Suite | Test)[])

  interpretOnlyMode(tasks)
  tasks.forEach((i) => {
    if (i.type === 'suite') {
      if (i.mode === 'skip')
        i.tasks.forEach(c => c.mode === 'run' && (c.mode = 'skip'))
      else
        interpretOnlyMode(i.tasks)
    }
  })

  return files
}
