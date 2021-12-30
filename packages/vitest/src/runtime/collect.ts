import { performance } from 'perf_hooks'
import { createHash } from 'crypto'
import { relative } from 'pathe'
import type { File, ResolvedConfig, Suite } from '../types'
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

function inModuleGraph(files: string[]) {
  return files.some(file => process.__vitest_worker__.moduleCache.has(file))
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

      if (config.findRelatedTests && !inModuleGraph(config.findRelatedTests))
        continue

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

    interpretTaskModes(file, config.testNamePattern)

    files.push(file)
  }

  return files
}

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
function interpretTaskModes(suite: Suite, namePattern?: string | RegExp, onlyMode?: boolean) {
  if (onlyMode === undefined)
    onlyMode = someTasksAreOnly(suite)

  suite.tasks.forEach((t) => {
    if (onlyMode) {
      if (t.type === 'suite' && someTasksAreOnly(t)) {
        // Don't skip this suite
        if (t.mode === 'only')
          t.mode = 'run'
        interpretTaskModes(t, namePattern, onlyMode)
      }
      else if (t.mode === 'run') { t.mode = 'skip' }
      else if (t.mode === 'only') { t.mode = 'run' }
    }
    if (t.type === 'test') {
      if (namePattern && !t.name.match(namePattern))
        t.mode = 'skip'
    }
    else if (t.type === 'suite') {
      if (t.mode === 'skip')
        skipAllTasks(t)

      // if all subtasks are skipped, marked as skip
      if (t.mode === 'run') {
        if (t.tasks.every(i => i.mode !== 'run'))
          t.mode = 'skip'
      }
    }
  })
}

function someTasksAreOnly(suite: Suite): boolean {
  return suite.tasks.some(t => t.mode === 'only' || (t.type === 'suite' && someTasksAreOnly(t)))
}

function skipAllTasks(suite: Suite) {
  suite.tasks.forEach((t) => {
    if (t.mode === 'run') {
      t.mode = 'skip'
      if (t.type === 'suite')
        skipAllTasks(t)
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
