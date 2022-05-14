import { relative } from 'pathe'
import type { File, ResolvedConfig, Suite, TaskBase } from '../types'
import { getWorkerState, isBrowser } from '../utils'
import { clearCollectorContext, defaultSuite } from './suite'
import { getHooks, setHooks } from './map'
import { processError } from './error'
import { collectorContext } from './context'
import { runSetupFiles } from './setup'

const now = Date.now

function hash(str: string): string {
  let hash = 0
  if (str.length === 0)
    return `${hash}`
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  return `${hash}`
}

export async function collectTests(paths: string[], config: ResolvedConfig) {
  const files: File[] = []

  const browserHashMap = getWorkerState().browserHashMap!

  async function importFromBrowser(filepath: string) {
    const match = filepath.match(/^(\w:\/)/)
    const hash = browserHashMap.get(filepath)
    if (match)
      return await import(`/@fs/${filepath.slice(match[1].length)}?v=${hash}`)
    else
      return await import(`${filepath}?v=${hash}`)
  }

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

    clearCollectorContext()
    try {
      await runSetupFiles(config)

      if (config.browser && isBrowser)
        await importFromBrowser(filepath)
      else
        await import(filepath)

      const defaultTasks = await defaultSuite.collect(file)

      setHooks(file, getHooks(defaultTasks))

      for (const c of [...defaultTasks.tasks, ...collectorContext.tasks]) {
        if (c.type === 'test') {
          file.tasks.push(c)
        }
        else if (c.type === 'suite') {
          file.tasks.push(c)
        }
        else {
          const start = now()
          const suite = await c.collect(file)
          file.collectDuration = now() - start
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
  if (allowOnly)
    return
  task.result = {
    state: 'fail',
    error: processError(new Error('[Vitest] Unexpected .only modifier. Remove it or pass --allowOnly argument to bypass this error')),
  }
}

function calculateHash(parent: Suite) {
  parent.tasks.forEach((t, idx) => {
    t.id = `${parent.id}_${idx}`
    if (t.type === 'suite')
      calculateHash(t)
  })
}
