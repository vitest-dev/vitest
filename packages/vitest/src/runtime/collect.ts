import type { File, ResolvedConfig, Suite } from '../types'
import { getWorkerState, isBrowser, relativePath } from '../utils'
import { interpretTaskModes, someTasksAreOnly } from '../utils/collect'
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

export async function collectTests(paths: string[], config: ResolvedConfig): Promise<File[]> {
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
    const path = relativePath(config.root, filepath)
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
      const setupStart = now()
      await runSetupFiles(config)

      const collectStart = now()
      file.setupDuration = collectStart - setupStart
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
        else if (c.type === 'benchmark') {
          file.tasks.push(c)
        }
        else if (c.type === 'suite') {
          file.tasks.push(c)
        }
        else if (c.type === 'collector') {
          const suite = await c.collect(file)
          if (suite.name || suite.tasks.length)
            file.tasks.push(suite)
        }
      }
      file.collectDuration = now() - collectStart
    }
    catch (e) {
      file.result = {
        state: 'fail',
        error: processError(e),
      }
      if (config.browser)
        console.error(e)
    }

    calculateHash(file)

    const hasOnlyTasks = someTasksAreOnly(file)
    interpretTaskModes(file, config.testNamePattern, hasOnlyTasks, false, config.allowOnly)

    files.push(file)
  }

  return files
}

function calculateHash(parent: Suite) {
  parent.tasks.forEach((t, idx) => {
    t.id = `${parent.id}_${idx}`
    if (t.type === 'suite')
      calculateHash(t)
  })
}
