import type { File, Test } from 'vitest'
import type { ProcessPool, Vitest } from 'vitest/node'
import { createMethodsRPC } from 'vitest/node'
import { getTasks } from '@vitest/runner/utils'
import { normalize, relative } from 'pathe'

export default (ctx: Vitest): ProcessPool => {
  const options = ctx.config.poolOptions?.custom as any
  return {
    name: 'custom',
    async runTests(specs) {
      console.warn('[pool] printing:', options.print)
      for await (const [project, file] of specs) {
        ctx.state.clearFiles(project)
        const methods = createMethodsRPC(project)
        console.warn('[pool] running tests for', project.getName(), 'in', normalize(file).toLowerCase().replace(normalize(process.cwd()).toLowerCase(), ''))
        const path = relative(project.config.root, file)
        const taskFile: File = {
          id: `${path}${project.getName()}`,
          name: path,
          mode: 'run',
          meta: {},
          projectName: project.getName(),
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
        taskFile.tasks.push(taskTest)
        await methods.onCollected([taskFile])
        await methods.onTaskUpdate(getTasks(taskFile).map(task => [task.id, task.result, task.meta]))
      }
    },
    close() {
      console.warn('[pool] custom pool is closed!')
    },
  }
}
