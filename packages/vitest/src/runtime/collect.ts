import { performance } from 'perf_hooks'
import { createHash } from 'crypto'
import { relative } from 'pathe'
import type { File, ResolvedConfig, Suite, Task } from '../types'
import { clearContext, defaultSuite } from './suite'
import { getHooks, setHooks } from './map'
import { processError } from './error'
import { context } from './context'
import { runSetupFiles } from './setup'

function hash(str: string, length = 10) {
  return createHash('md5')
    .update(str)
    .digest('hex')
    .slice(0, length)
}

export async function collectTests(paths: string[], config: ResolvedConfig) {
  const files: File[] = []

  for (const filepath of paths) {
    const path = relative(config.root, filepath)
    const file: File = {
      id: hash(path),
      name: path,
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

    calculateHash(file)
    files.push(file)
  }

  interpretTaskModes(files, config.testNamePattern)

  return files
}

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
function interpretTaskModes(tasks: Task[], namePattern?: string | RegExp) {
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

      interpretTaskModes(t.tasks, namePattern)

      // if all subtasks are skipped, marked as skip
      if (t.mode === 'run') {
        if (t.tasks.every(i => i.mode !== 'run'))
          t.mode = 'skip'
      }
    }
  })
}

function calculateHash(parent: Suite) {
  parent.tasks.forEach((t, idx) => {
    t.id = `${parent.id}_${idx}`
    if (t.type === 'suite')
      calculateHash(t)
  })
}
