import { performance } from 'perf_hooks'
import { basename } from 'pathe'
import { nanoid } from 'nanoid/non-secure'
import type { File, ResolvedConfig, Suite, Test } from '../types'
import { interpretOnlyMode } from '../utils'
import { clearContext, defaultSuite } from './suite'
import { getHooks, setHooks } from './map'
import { processError } from './error'
import { context } from './context'
import { runSetupFiles } from './setup'

export async function collectTests(paths: string[], config: ResolvedConfig) {
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
    }

    clearContext()
    try {
      await runSetupFiles(config)
      await import(filepath)

      const defaultTasks = await defaultSuite.collect(file)

      setHooks(file, getHooks(defaultTasks))

      for (const c of [...defaultTasks.tasks, ...context.tasks]) {
        if (c.type === 'test') {
          file.tasks.push(c)
        }
        else if (c.type === 'suite') {
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
      // not sure thy, this this line is needed to trigger the error
      process.stdout.write('\0')
    }

    files.push(file)
  }

  const tasks = files.reduce((tasks, file) => tasks.concat(file.tasks), [] as (Suite | Test)[])

  interpretOnlyMode(tasks)

  return files
}
