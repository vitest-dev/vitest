import type { File } from './types'
import type { VitestRunner } from './types/runner'
import { calculateSuiteHash, generateHash, interpretTaskModes, someTasksAreOnly } from './utils/collect'
import { clearCollectorContext, getDefaultSuite } from './suite'
import { getHooks, setHooks } from './map'
import { processError } from './utils/error'
import { collectorContext } from './context'
import { runSetupFiles } from './setup'

const now = Date.now

export async function collectTests(paths: string[], runner: VitestRunner): Promise<File[]> {
  const files: File[] = []

  const config = runner.config

  for (const filepath of paths) {
    // TODO /full/path/to/file.js -> /to/file
    const path = filepath.slice(config.root.length + 1)
    const file: File = {
      id: generateHash(path),
      name: path,
      type: 'suite',
      mode: 'run',
      filepath,
      tasks: [],
      projectName: config.name,
    }

    clearCollectorContext(runner)

    try {
      const setupStart = now()
      await runSetupFiles(config, runner)

      const collectStart = now()
      file.setupDuration = collectStart - setupStart

      await runner.importFile(filepath)

      const defaultTasks = await getDefaultSuite().collect(file)

      setHooks(file, getHooks(defaultTasks))

      for (const c of [...defaultTasks.tasks, ...collectorContext.tasks]) {
        if (c.type === 'test') {
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
      const error = processError(e)
      file.result = {
        state: 'fail',
        error,
        errors: [error],
      }
    }

    calculateSuiteHash(file)

    const hasOnlyTasks = someTasksAreOnly(file)
    interpretTaskModes(file, config.testNamePattern, hasOnlyTasks, false, config.allowOnly)

    files.push(file)
  }

  return files
}
