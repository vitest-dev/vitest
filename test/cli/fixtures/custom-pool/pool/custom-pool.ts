import type {
  RunnerTestFile,
  RunnerTestCase,
  RunnerTestSuite,
  RunnerTaskResultPack,
  RunnerTaskEventPack,
  RunnerTask
} from 'vitest'
import type { ProcessPool, Vitest } from 'vitest/node'
import { createFileTask, generateFileHash } from '@vitest/runner/utils'
import { normalize, relative } from 'pathe'

export default (vitest: Vitest): ProcessPool => {
  const options = vitest.config.poolOptions?.custom as any
  return {
    name: 'custom',
    async collectTests() {
      throw new Error('Not implemented')
    },
    async runTests(specs) {
      vitest.logger.console.warn('[pool] printing:', options.print)
      vitest.logger.console.warn('[pool] array option', options.array)
      for (const [project, file] of specs) {
        vitest.state.clearFiles(project)
        vitest.logger.console.warn('[pool] running tests for', project.name, 'in', normalize(file).toLowerCase().replace(normalize(process.cwd()).toLowerCase(), ''))
        const taskFile = createFileTask(
          file,
          project.config.root,
          project.name,
          'custom'
        )
        taskFile.mode = 'run'
        taskFile.result = { state: 'pass' }
        const taskTest: RunnerTestCase = {
          type: 'test',
          name: 'custom test',
          id: `${taskFile.id}_0`,
          context: {} as any,
          suite: taskFile,
          mode: 'run',
          meta: {},
          annotations: [],
          timeout: 0,
          file: taskFile,
          result: {
            state: 'pass',
          },
        }
        taskFile.tasks.push(taskTest)
        await vitest._reportFileTask(taskFile)
      }
    },
    close() {
      vitest.logger.console.warn('[pool] custom pool is closed!')
    },
  }
}
