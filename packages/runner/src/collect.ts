import { relative } from 'pathe'
import { processError } from '@vitest/utils/error'
import type { File } from './types'
import type { VitestRunner } from './types/runner'
import { calculateSuiteHash, generateHash, interpretTaskModes, someTasksAreOnly } from './utils/collect'
import { clearCollectorContext, getDefaultSuite } from './suite'
import { getHooks, setHooks } from './map'
import { collectorContext } from './context'
import { runSetupFiles } from './setup'

const now = Date.now

export async function collectTests(paths: string[], runner: VitestRunner): Promise<File[]> {
  const files: File[] = []

  const config = runner.config

  for (const filepath of paths) {
    const path = relative(config.root, filepath)
    const file: File = {
      id: generateHash(`${path}${config.name || ''}`),
      name: path,
      type: 'suite',
      mode: 'run',
      filepath,
      tasks: [],
      meta: Object.create(null),
      projectName: config.name,
    }

    clearCollectorContext(runner)

    try {
      const setupStart = now()
      await runSetupFiles(config, runner)

      const collectStart = now()
      file.setupDuration = collectStart - setupStart

      await runner.importFile(filepath, 'collect')

      const defaultTasks = await getDefaultSuite().collect(file)

      setHooks(file, getHooks(defaultTasks))

      for (const c of [...defaultTasks.tasks, ...collectorContext.tasks]) {
        if (c.type === 'test') {
          file.tasks.push(c)
        }
        else if (c.type === 'custom') {
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
