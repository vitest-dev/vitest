import type { FileSpecification, VitestRunner } from './types/runner'
import type { File, SuiteHooks } from './types/tasks'
import { toArray } from '@vitest/utils'
import { processError } from '@vitest/utils/error'
import { collectorContext } from './context'
import { getHooks, setHooks } from './map'
import { runSetupFiles } from './setup'
import {
  clearCollectorContext,
  createSuiteHooks,
  getDefaultSuite,
} from './suite'
import {
  calculateSuiteHash,
  createFileTask,
  interpretTaskModes,
  someTasksAreOnly,
} from './utils/collect'

const now = globalThis.performance ? globalThis.performance.now.bind(globalThis.performance) : Date.now

export async function collectTests(
  specs: string[] | FileSpecification[],
  runner: VitestRunner,
): Promise<File[]> {
  const files: File[] = []

  const config = runner.config

  for (const spec of specs) {
    const filepath = typeof spec === 'string' ? spec : spec.filepath
    const testLocations = typeof spec === 'string' ? undefined : spec.testLocations

    const file = createFileTask(filepath, config.root, config.name, runner.pool)
    file.shuffle = config.sequence.shuffle

    runner.onCollectStart?.(file)

    clearCollectorContext(filepath, runner)

    try {
      const setupFiles = toArray(config.setupFiles)
      if (setupFiles.length) {
        const setupStart = now()
        await runSetupFiles(config, setupFiles, runner)
        const setupEnd = now()
        file.setupDuration = setupEnd - setupStart
      }
      else {
        file.setupDuration = 0
      }

      const collectStart = now()

      await runner.importFile(filepath, 'collect')

      const defaultTasks = await getDefaultSuite().collect(file)

      const fileHooks = createSuiteHooks()
      mergeHooks(fileHooks, getHooks(defaultTasks))

      for (const c of [...defaultTasks.tasks, ...collectorContext.tasks]) {
        if (c.type === 'test' || c.type === 'suite') {
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

    file.tasks.forEach((task) => {
      // task.suite refers to the internal default suite object
      // it should not be reported
      if (task.suite?.id === '') {
        delete task.suite
      }
    })

    const hasOnlyTasks = someTasksAreOnly(file)
    interpretTaskModes(
      file,
      config.testNamePattern,
      testLocations,
      hasOnlyTasks,
      false,
      config.allowOnly,
    )

    if (file.mode === 'queued') {
      file.mode = 'run'
    }

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
