import type { FileSpecification } from '@vitest/runner'
import type { DeferPromise } from '@vitest/utils'
import type { TypecheckResults } from '../../../typecheck/typechecker'
import type { Vitest } from '../../core'
import type { TestProject } from '../../project'
import type { TestRunEndReason } from '../../types/reporter'
import type { PoolOptions, PoolWorker, WorkerRequest, WorkerResponse } from '../types'
import EventEmitter from 'node:events'
import { hasFailed } from '@vitest/runner/utils'
import { createDefer } from '@vitest/utils/helpers'
import { Typechecker } from '../../../typecheck/typechecker'

/** @experimental */
export class TypecheckPoolWorker implements PoolWorker {
  public readonly name: string = 'typecheck'
  private readonly project: TestProject

  private _eventEmitter = new EventEmitter()

  constructor(options: PoolOptions) {
    this.project = options.project
  }

  async start(): Promise<void> {
    // noop, onMessage handles it
  }

  async stop(): Promise<void> {
    // noop, onMessage handles it
  }

  canReuse(): boolean {
    return true
  }

  send(message: WorkerRequest): void {
    void onMessage(message, this.project).then((response) => {
      if (response) {
        this._eventEmitter.emit('message', response)
      }
    })
  }

  on(event: string, callback: (arg: any) => any): void {
    this._eventEmitter.on(event, callback)
  }

  off(event: string, callback: (arg: any) => any): void {
    this._eventEmitter.on(event, callback)
  }

  deserialize(data: unknown): unknown {
    return data
  }
}

const __vitest_worker_response__ = true
const runners = new WeakMap<Vitest, ReturnType<typeof createRunner>>()

async function onMessage(message: WorkerRequest, project: TestProject): Promise<WorkerResponse | void> {
  if (message?.__vitest_worker_request__ !== true) {
    return undefined
  }

  let runner = runners.get(project.vitest)
  if (!runner) {
    runner = createRunner(project.vitest)
    runners.set(project.vitest, runner)
  }

  let runPromise: Promise<unknown> | undefined

  switch (message.type) {
    case 'start': {
      return { type: 'started', __vitest_worker_response__ }
    }

    case 'run': {
      runPromise = runner.runTests(message.context.files, project)
        .catch(error => error)
      const error = await runPromise

      return { type: 'testfileFinished', error, __vitest_worker_response__ }
    }

    case 'collect': {
      runPromise = runner.collectTests(message.context.files, project)
        .catch(error => error)
      const error = await runPromise

      return { type: 'testfileFinished', error, __vitest_worker_response__ }
    }

    case 'stop': {
      await runPromise
      return { type: 'stopped', __vitest_worker_response__ }
    }
  }

  throw new Error(`Unexpected message ${JSON.stringify(message, null, 2)}`)
}

function createRunner(vitest: Vitest) {
  const promisesMap = new WeakMap<TestProject, DeferPromise<void>>()
  const rerunTriggered = new WeakSet<TestProject>()

  async function onParseEnd(
    project: TestProject,
    { files, sourceErrors }: TypecheckResults,
  ) {
    const checker = project.typechecker!

    const { packs, events } = checker.getTestPacksAndEvents()
    await vitest._testRun.updated(packs, events)

    if (!project.config.typecheck.ignoreSourceErrors) {
      sourceErrors.forEach(error =>
        vitest.state.catchError(error, 'Unhandled Source Error'),
      )
    }

    const processError = !hasFailed(files) && !sourceErrors.length && checker.getExitCode()
    if (processError) {
      const error = new Error(checker.getOutput())
      error.stack = ''
      vitest.state.catchError(error, 'Typecheck Error')
    }

    promisesMap.get(project)?.resolve()

    rerunTriggered.delete(project)

    // triggered by TSC watcher, not Vitest watcher, so we need to emulate what Vitest does in this case
    if (vitest.config.watch && !vitest.runningPromise) {
      const modules = files.map(file => vitest.state.getReportedEntity(file)).filter(e => e?.type === 'module')

      const state: TestRunEndReason = vitest.isCancelling
        ? 'interrupted'
        : modules.some(m => !m.ok())
          ? 'failed'
          : 'passed'

      await vitest.report('onTestRunEnd', modules, [], state)
      await vitest.report('onWatcherStart', files, [
        ...(project.config.typecheck.ignoreSourceErrors ? [] : sourceErrors),
        ...vitest.state.getUnhandledErrors(),
      ])
    }
  }

  async function createWorkspaceTypechecker(
    project: TestProject,
    files: string[],
  ) {
    const checker = project.typechecker ?? new Typechecker(project)
    if (project.typechecker) {
      return checker
    }

    project.typechecker = checker
    checker.setFiles(files)

    checker.onParseStart(async () => {
      const files = checker.getTestFiles()
      for (const file of files) {
        await vitest._testRun.enqueued(project, file)
      }
      await vitest._testRun.collected(project, files)
    })

    checker.onParseEnd(result => onParseEnd(project, result))

    checker.onWatcherRerun(async () => {
      rerunTriggered.add(project)

      if (!vitest.runningPromise) {
        vitest.state.clearErrors()
        await vitest.report(
          'onWatcherRerun',
          files,
          'File change detected. Triggering rerun.',
        )
      }

      await checker.collectTests()

      const testFiles = checker.getTestFiles()
      for (const file of testFiles) {
        await vitest._testRun.enqueued(project, file)
      }
      await vitest._testRun.collected(project, testFiles)

      const { packs, events } = checker.getTestPacksAndEvents()
      await vitest._testRun.updated(packs, events)
    })

    return checker
  }

  async function startTypechecker(project: TestProject, files: string[]) {
    if (project.typechecker) {
      return
    }
    const checker = await createWorkspaceTypechecker(project, files)
    await checker.collectTests()
    await checker.start()
  }

  async function collectTests(specs: FileSpecification[], project: TestProject) {
    const files = specs.map(spec => spec.filepath)
    const checker = await createWorkspaceTypechecker(project, files)
    checker.setFiles(files)
    await checker.collectTests()
    const testFiles = checker.getTestFiles()
    vitest.state.collectFiles(project, testFiles)
  }

  async function runTests(specs: FileSpecification[], project: TestProject) {
    const promises: Promise<void>[] = []

    const files = specs.map(spec => spec.filepath)
    const promise = createDefer<void>()

    // check that watcher actually triggered rerun
    const triggered = await new Promise<boolean>((resolve) => {
      const _i = setInterval(() => {
        if (!project.typechecker || rerunTriggered.has(project)) {
          resolve(true)
          clearInterval(_i)
        }
      })
      setTimeout(() => {
        resolve(false)
        clearInterval(_i)
      }, 500).unref()
    })

    // Re-run but wasn't triggered by tsc
    if (promisesMap.has(project) && !triggered) {
      return promisesMap.get(project)
    }

    if (project.typechecker && !triggered) {
      const testFiles = project.typechecker.getTestFiles()

      for (const file of testFiles) {
        await vitest._testRun.enqueued(project, file)
      }

      await vitest._testRun.collected(project, testFiles)
      await onParseEnd(project, project.typechecker.getResult())
    }

    promises.push(promise)
    promisesMap.set(project, promise)
    promises.push(startTypechecker(project, files))

    await Promise.all(promises)
  }

  return {
    runTests,
    collectTests,
  }
}
