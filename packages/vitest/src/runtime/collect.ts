import { performance } from 'perf_hooks'
import { relative } from 'pathe'
import { nanoid } from 'nanoid/non-secure'
import type { File, ResolvedConfig, Suite, Task, Test } from '../types'
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
      name: relative(config.root, filepath),
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

  interpretOnlyMode(tasks, config.testNamePattern)

  return files
}

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
export function interpretOnlyMode(tasks: Task[], namePattern?: string | RegExp) {
  if (tasks.some(t => t.mode === 'only')) {
    tasks.forEach((t) => {
      if (t.mode === 'run')
        t.mode = 'skip'
      else if (t.mode === 'only')
        t.mode = 'run'
    })
  }
  tasks.forEach((t) => {
    if (t.type === 'test') {
      if (namePattern && !t.name.match(namePattern))
        t.mode = 'skip'
    }
    else if (t.type === 'suite') {
      if (t.mode === 'skip')
        t.tasks.forEach(c => c.mode === 'run' && (c.mode = 'skip'))
      else
        interpretOnlyMode(t.tasks)
    }
  })
}
