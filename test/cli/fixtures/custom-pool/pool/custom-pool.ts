import type { RunnerTestCase } from 'vitest'
import { BaseRuntime, PoolRuntimeConstructor, PoolRuntimeOptions, TestProject, WorkerRequest, WorkerResponse, type PoolRuntime, type ProcessPool, type Vitest } from 'vitest/node'
import { createFileTask } from '@vitest/runner/utils'
import { normalize } from 'pathe'
import EventEmitter from 'node:events';

interface OptionsCustomPool {
  print: any;
  array: any;
}

export function createCustomPool(settings: OptionsCustomPool): PoolRuntimeConstructor {
  return class PublicCustomRuntime extends CustomRuntime {
    static runtime = 'custom'

    constructor(options: PoolRuntimeOptions) {
      super(options, settings)
    }
  }
}

export class CustomRuntime extends BaseRuntime implements PoolRuntime {
  name = 'custom'
  private vitest: Vitest
  private customEvents = new EventEmitter()

  constructor(options: PoolRuntime['options'], private settings: OptionsCustomPool) {
    super(options)
    this.vitest = options.project.vitest
  }

  postMessage(request: WorkerRequest): void {
    void onMessage(request, this.options.project, this.settings).then((response) => {
      if (response) {
        this.customEvents.emit('message', response)
      }
    })
  }

  onWorker(event: string, callback: (arg: any) => void): void {
    if (event === 'message') {
      this.customEvents.on('message', callback)
    }
  }

  offWorker(event: string, callback: (arg: any) => void): void {
    if (event === 'message') {
      this.customEvents.off('message', callback)
    }
  }

  async stop() {
    this.vitest.logger.console.warn('[pool] custom pool is closed!')
    return super.stop()
  }
}

const __vitest_worker_response__ = true

async function onMessage(message: WorkerRequest, project: TestProject, options: OptionsCustomPool): Promise<WorkerResponse | void> {
  if (message?.__vitest_worker_request__ !== true) {
    return undefined
  }
  const vitest = project.vitest

  switch (message.type) {
    case 'start': {
      return { type: 'started', __vitest_worker_response__ }
    }

    case 'run': {
      vitest.logger.console.warn('[pool] printing:', options.print)
      vitest.logger.console.warn('[pool] array option', options.array)
      for (const { filepath: moduleId } of message.context.files) {
        vitest.state.clearFiles(project)
        vitest.logger.console.warn('[pool] running tests for', project.name, 'in', normalize(moduleId).toLowerCase().replace(normalize(process.cwd()).toLowerCase(), ''))
        const taskFile = createFileTask(
          moduleId,
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

      return { type: 'testfileFinished', __vitest_worker_response__ }
    }

    case 'stop': {
      return { type: 'stopped', __vitest_worker_response__ }
    }
  }

  throw new Error(`Unexpected message ${JSON.stringify(message, null, 2)}`)
}
