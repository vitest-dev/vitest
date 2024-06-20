import { processError } from '@vitest/utils/error'
import type { File, SuiteHooks } from './types'
import type { VitestRunner } from './types/runner'
import {
  calculateSuiteHash,
  createFileTask,
  interpretTaskModes,
  someTasksAreOnly,
} from './utils/collect'
import {
  clearCollectorContext,
  createSuiteHooks,
  getDefaultSuite,
} from './suite'
import { getHooks, setHooks } from './map'
import { collectorContext } from './context'
import { runSetupFiles } from './setup'

const now = Date.now

export async function collectTests(
  paths: string[],
  runner: VitestRunner,
): Promise<File[]> {
  const files: File[] = []

  const config = runner.config

  for (const filepath of paths) {
    const file = createFileTask(filepath, config.root, config.name)

    runner.onCollectStart?.(file)

    clearCollectorContext(filepath, runner)

    try {
      const setupStart = now()
      await runSetupFiles(config, runner)

      const collectStart = now()
      file.setupDuration = collectStart - setupStart

      await runner.importFile(filepath, 'collect')

      const defaultTasks = await getDefaultSuite().collect(file)

      const fileHooks = createSuiteHooks()
      mergeHooks(fileHooks, getHooks(defaultTasks))

      for (const c of [...defaultTasks.tasks, ...collectorContext.tasks]) {
        if (c.type === 'test' || c.type === 'custom' || c.type === 'suite') {
          file.tasks.push(c)
        }
        else if (c.type === 'collector') {
          const suite = await c.collect(file)
          if (suite.name || suite.tasks.length) {
            mergeHooks(fileHooks, getHooks(suite))
            file.tasks.push(suite)
          }
        }
        else {
          // check that types are exhausted
          c satisfies never
        }
      }

      setHooks(file, fileHooks)
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
    interpretTaskModes(
      file,
      config.testNamePattern,
      hasOnlyTasks,
      false,
      config.allowOnly,
    )

    file.tasks.forEach((task) => {
      // task.suite refers to the internal default suite object
      // it should not be reported
      if (task.suite?.id === '') {
        delete task.suite
      }
    })
    files.push(file)
  }

  return files
}

function mergeHooks(baseHooks: SuiteHooks, hooks: SuiteHooks): SuiteHooks {
  for (const _key in hooks) {
    const key = _key as keyof SuiteHooks
    baseHooks[key].push(...(hooks[key] as any))
  }

  return baseHooks
}
