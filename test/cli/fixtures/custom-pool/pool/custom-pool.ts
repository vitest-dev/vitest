import type { RunnerTestCase } from 'vitest'
import type { RuntimeWorker, PoolRuntimeInitializer, TestProject, Vitest, WorkerRequest, WorkerResponse, PoolRuntimeOptions } from 'vitest/node'
import { createFileTask } from '@vitest/runner/utils'
import { normalize } from 'pathe'
import EventEmitter from 'node:events';

interface OptionsCustomPool {
  print: any;
  array: any;
}

export function createCustomPool(settings: OptionsCustomPool): PoolRuntimeInitializer {
  return {
    runtime: 'custom',
    createWorker: (options) => new CustomRuntimeWorker(options, settings),
  }
}

export class CustomRuntimeWorker implements RuntimeWorker {
  public readonly name = 'custom'
  private vitest: Vitest
  private customEvents = new EventEmitter()
  readonly execArgv: string[]
  readonly env: Record<string, string>
  private project: TestProject

  constructor(options: PoolRuntimeOptions, private settings: OptionsCustomPool) {
    this.execArgv = options.execArgv
    this.env = options.env
    this.vitest = options.project.vitest
    this.project = options.project
  }

  send(request: WorkerRequest) {
    void onMessage(request, this.project, this.settings).then((response) => {
      if (response) {
        this.customEvents.emit('message', response)
      }
    })
  }

  on(event: string, callback: (arg: any) => void): void {
    this.customEvents.on(event, callback)
  }

  off(event: string, callback: (arg: any) => void): void {
    this.customEvents.off(event, callback)
  }

  deserialize(data: unknown): unknown {
    return data
  }

  async start() {
    // noop
  }

  async stop() {
    this.vitest.logger.console.warn('[pool] custom pool is closed!')
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
