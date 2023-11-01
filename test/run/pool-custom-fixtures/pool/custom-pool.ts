import type { File, TaskResultPack, Test } from 'vitest'
import type { ProcessPool, Vitest } from 'vitest/node'
import { createMethodsRPC } from 'vitest/node'

export default (ctx: Vitest): ProcessPool => {
  const options = ctx.config.poolOptions?.custom as any
  return {
    name: 'custom',
    async runTests(specs) {
      console.warn('[pool] printing:', options.print)
      for await (const [project, file] of specs) {
        ctx.state.clearFiles(project)
        const methods = createMethodsRPC(project)
        console.warn('[pool] running tests for', project.getName(), 'in', file.replace(process.cwd(), ''))
        const taskFile: File = {
          id: 'custom-test-file',
          name: 'custom test file',
          mode: 'run',
          meta: {},
          filepath: file,
          type: 'suite',
          tasks: [],
          result: {
            state: 'pass',
          },
        }
        const taskTest: Test = {
          type: 'test',
          name: 'custom test',
          id: 'custom-test',
          context: {} as any,
          suite: taskFile,
          mode: 'run',
          meta: {},
          result: {
            state: 'pass',
          },
        }
        const taskPack: TaskResultPack = [
          taskTest.id,
          taskTest.result,
          taskTest.meta,
        ]
        taskFile.tasks.push(taskTest)
        await methods.onCollected([taskFile])
        await methods.onTaskUpdate([taskPack])
      }
    },
    close() {
      console.warn('[pool] custom pool is closed!')
    },
  }
}
