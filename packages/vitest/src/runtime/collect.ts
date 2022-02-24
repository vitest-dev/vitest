import { createHash } from 'crypto'
import { relative } from 'pathe'
import type { File, ResolvedConfig, Suite, TaskBase } from '../types'
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
          const start = performance.now()
          const suite = await c.collect(file)
          file.collectDuration = performance.now() - start
          if (suite.name || suite.tasks.length)
            file.tasks.push(suite)
        }
      }
    }
    catch (e) {
      file.result = {
        state: 'fail',
        error: processError(e),
      }
      // not sure thy, this this line is needed to trigger the error
      process.stdout.write('\0')
    }

    calculateHash(file)

    const hasOnlyTasks = someTasksAreOnly(file)
    interpretTaskModes(file, config.testNamePattern, hasOnlyTasks, false, config.allowOnly)

    files.push(file)
  }

  return files
}

/**
 * If any tasks been marked as `only`, mark all other tasks as `skip`.
 */
function interpretTaskModes(suite: Suite, namePattern?: string | RegExp, onlyMode?: boolean, parentIsOnly?: boolean, allowOnly?: boolean) {
  const suiteIsOnly = parentIsOnly || suite.mode === 'only'

  suite.tasks.forEach((t) => {
    // Check if either the parent suite or the task itself are marked as included
    const includeTask = suiteIsOnly || t.mode === 'only'
    if (onlyMode) {
      if (t.type === 'suite' && (includeTask || someTasksAreOnly(t))) {
        // Don't skip this suite
        if (t.mode === 'only') {
          checkAllowOnly(t, allowOnly)
          t.mode = 'run'
        }
      }
      else if (t.mode === 'run' && !includeTask) { t.mode = 'skip' }
      else if (t.mode === 'only') {
        checkAllowOnly(t, allowOnly)
        t.mode = 'run'
      }
    }
    if (t.type === 'test') {
      if (namePattern && !getTaskFullName(t).match(namePattern))
        t.mode = 'skip'
    }
    else if (t.type === 'suite') {
      if (t.mode === 'skip')
        skipAllTasks(t)
      else
        interpretTaskModes(t, namePattern, onlyMode, includeTask, allowOnly)
    }
  })

  // if all subtasks are skipped, mark as skip
  if (suite.mode === 'run') {
    if (suite.tasks.length && suite.tasks.every(i => i.mode !== 'run'))
      suite.mode = 'skip'
  }
}

function getTaskFullName(task: TaskBase): string {
  return `${task.suite ? `${getTaskFullName(task.suite)} ` : ''}${task.name}`
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

function checkAllowOnly(task: TaskBase, allowOnly?: boolean) {
  if (allowOnly) return
  task.result = {
    state: 'fail',
    error: processError(new Error('[Vitest] Unexpected .only modifier. Remove it or pass --allowOnly arguement to bypass this error')),
  }
}

function calculateHash(parent: Suite) {
  parent.tasks.forEach((t, idx) => {
    t.id = `${parent.id}_${idx}`
    if (t.type === 'suite')
      calculateHash(t)
  })
}
