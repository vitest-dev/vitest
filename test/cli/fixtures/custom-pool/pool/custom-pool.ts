import type { RunnerTestFile, RunnerTestCase } from 'vitest'
import type { ProcessPool, Vitest } from 'vitest/node'
import { createMethodsRPC } from 'vitest/node'
import { getTasks, generateFileHash } from '@vitest/runner/utils'
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
        const methods = createMethodsRPC(project)
        vitest.logger.console.warn('[pool] running tests for', project.name, 'in', normalize(file).toLowerCase().replace(normalize(process.cwd()).toLowerCase(), ''))
        const path = relative(project.config.root, file)
        const taskFile: RunnerTestFile = {
          id: generateFileHash(path, project.config.name),
          name: path,
          mode: 'run',
          meta: {},
          projectName: project.name,
          filepath: file,
          type: 'suite',
          tasks: [],
          result: {
            state: 'pass',
          },
          file: null!,
        }
        taskFile.file = taskFile
        const taskTest: RunnerTestCase = {
          type: 'test',
          name: 'custom test',
          id: 'custom-test',
          context: {} as any,
          suite: taskFile,
          mode: 'run',
          meta: {},
          file: taskFile,
          result: {
            state: 'pass',
          },
        }
        taskFile.tasks.push(taskTest)
        await methods.onCollected([taskFile])
        await methods.onTaskUpdate(getTasks(taskFile).map(task => [
          task.id,
          task.result,
          task.meta,
        ]), [])
      }
    },
    close() {
      vitest.logger.console.warn('[pool] custom pool is closed!')
    },
  }
}
