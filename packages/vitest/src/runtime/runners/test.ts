import type { SpanOptions } from '@opentelemetry/api'
import type { ExpectStatic, MatcherState } from '@vitest/expect'
import type {
  CancelReason,
  File,
  ImportDuration,
  Suite,
  Task,
  Test,
  TestContext,
  VitestRunner,
  VitestRunnerImportSource,
} from '@vitest/runner'
import type { ModuleRunner } from 'vite/module-runner'
import type { Traces } from '../../utils/traces'
import type { SerializedConfig } from '../config'
import { getState, GLOBAL_EXPECT, setState } from '@vitest/expect'
import { getNames, getTestName, getTests } from '@vitest/runner/utils'
import { processError } from '@vitest/utils/error'
import { normalize } from 'pathe'
import { createExpect } from '../../integrations/chai/index'
import { inject } from '../../integrations/inject'
import { getSnapshotClient } from '../../integrations/snapshot/chai'
import { vi } from '../../integrations/vi'
import { rpc } from '../rpc'
import { getWorkerState } from '../utils'

// worker context is shared between all tests
const workerContext = Object.create(null)

export class VitestTestRunner implements VitestRunner {
  private snapshotClient = getSnapshotClient()
  private workerState = getWorkerState()
  private moduleRunner!: ModuleRunner
  private cancelRun = false

  private assertionsErrors = new WeakMap<Readonly<Task>, Error>()

  public pool: string = this.workerState.ctx.pool
  private _otel!: Traces

  constructor(public config: SerializedConfig) {}

  importFile(filepath: string, source: VitestRunnerImportSource): unknown {
    if (source === 'setup') {
      const moduleNode = this.workerState.evaluatedModules.getModuleById(filepath)
      if (moduleNode) {
        this.workerState.evaluatedModules.invalidateModule(moduleNode)
      }
    }
    return this._otel.$(
      `vitest.module.import_${source === 'setup' ? 'setup' : 'spec'}`,
      {
        attributes: {
          'code.file.path': filepath,
        },
      },
      () => this.moduleRunner.import(filepath),
    )
  }

  onCollectStart(file: File): void {
    this.workerState.current = file
  }

  onCleanupWorkerContext(listener: () => unknown): void {
    this.workerState.onCleanup(listener)
  }

  onAfterRunFiles(): void {
    this.snapshotClient.clear()
    this.workerState.current = undefined
  }

  getWorkerContext(): Record<string, unknown> {
    return workerContext
  }

  async onAfterRunSuite(suite: Suite): Promise<void> {
    if (this.config.logHeapUsage && typeof process !== 'undefined') {
      suite.result!.heap = process.memoryUsage().heapUsed
    }

    if (suite.mode !== 'skip' && 'filepath' in suite) {
      // mark snapshots in skipped tests as not obsolete
      for (const test of getTests(suite)) {
        if (test.mode === 'skip') {
          const name = getNames(test).slice(1).join(' > ')
          this.snapshotClient.skipTest(suite.file.filepath, name)
        }
      }

      const result = await this.snapshotClient.finish(suite.file.filepath)
      if (
        this.workerState.config.snapshotOptions.updateSnapshot === 'none'
        && result.unchecked
      ) {
        let message = `Obsolete snapshots found when no snapshot update is expected.\n`
        for (const key of result.uncheckedKeys) {
          message += `· ${key}\n`
        }
        suite.result!.errors ??= []
        suite.result!.errors.push(processError(new Error(message)))
        suite.result!.state = 'fail'
      }
      await rpc().snapshotSaved(result)
    }

    this.workerState.current = suite.suite || suite.file
  }

  onAfterRunTask(test: Task): void {
    if (this.config.logHeapUsage && typeof process !== 'undefined') {
      test.result!.heap = process.memoryUsage().heapUsed
    }

    this.workerState.current = test.suite || test.file
  }

  cancel(_reason: CancelReason): void {
    this.cancelRun = true
  }

  injectValue(key: string): any {
    // inject has a very limiting type controlled by ProvidedContext
    // some tests override it which causes the build to fail
    return (inject as any)(key)
  }

  async onBeforeRunTask(test: Task): Promise<void> {
    if (this.cancelRun) {
      test.mode = 'skip'
    }

    if (test.mode !== 'run' && test.mode !== 'queued') {
      return
    }

    this.workerState.current = test
  }

  async onBeforeRunSuite(suite: Suite): Promise<void> {
    if (this.cancelRun) {
      suite.mode = 'skip'
    }

    // initialize snapshot state before running file suite
    if (suite.mode !== 'skip' && 'filepath' in suite) {
      await this.snapshotClient.setup(
        suite.file.filepath,
        this.workerState.config.snapshotOptions,
      )
    }

    this.workerState.current = suite
  }

  onBeforeTryTask(test: Task): void {
    clearModuleMocks(this.config)
    this.snapshotClient.clearTest(test.file.filepath, test.id)

    const state: Partial<MatcherState> = {
      assertionCalls: 0,
      isExpectingAssertions: false,
      isExpectingAssertionsError: null,
      expectedAssertionsNumber: null,
      expectedAssertionsNumberErrorGen: null,
      currentTestName: getTestName(test),
      snapshotState: this.snapshotClient.getSnapshotState(test.file.filepath),
    }

    if (test.type === 'test') {
      state.task = test
    }

    setState(
      state,
      (globalThis as any)[GLOBAL_EXPECT],
    )
  }

  onAfterTryTask(test: Test): void {
    const {
      assertionCalls,
      expectedAssertionsNumber,
      expectedAssertionsNumberErrorGen,
      isExpectingAssertions,
      isExpectingAssertionsError,
    }
      = test.context._local
        ? test.context.expect.getState()
        : getState((globalThis as any)[GLOBAL_EXPECT])
    if (
      expectedAssertionsNumber !== null
      && assertionCalls !== expectedAssertionsNumber
    ) {
      throw expectedAssertionsNumberErrorGen!()
    }
    if (isExpectingAssertions === true && assertionCalls === 0) {
      throw isExpectingAssertionsError
    }
    if (this.config.expect.requireAssertions && assertionCalls === 0) {
      throw this.assertionsErrors.get(test)
    }
  }

  extendTaskContext(context: TestContext): TestContext {
    // create error during the test initialization so we have a nice stack trace
    if (this.config.expect.requireAssertions) {
      this.assertionsErrors.set(
        context.task,
        new Error('expected any number of assertion, but got none'),
      )
    }
    let _expect: ExpectStatic | undefined
    Object.defineProperty(context, 'expect', {
      get() {
        if (!_expect) {
          _expect = createExpect(context.task)
        }
        return _expect
      },
    })
    Object.defineProperty(context, '_local', {
      get() {
        return _expect != null
      },
    })
    return context
  }

  getImportDurations(): Record<string, ImportDuration> {
    const importDurations: Record<string, ImportDuration> = {}
    const entries = this.workerState.moduleExecutionInfo?.entries() || []

    for (const [filepath, { duration, selfTime }] of entries) {
      importDurations[normalize(filepath)] = {
        selfTime,
        totalTime: duration,
      }
    }

    return importDurations
  }

  trace = <T>(name: string, attributes: Record<string, any> | (() => T), cb?: () => T): T => {
    const options: SpanOptions = typeof attributes === 'object' ? { attributes } : {}
    return this._otel.$(`vitest.test.runner.${name}`, options, cb || attributes as () => T)
  }

  __setTraces(traces: Traces): void {
    this._otel = traces
  }
}

function clearModuleMocks(config: SerializedConfig) {
  const { clearMocks, mockReset, restoreMocks, unstubEnvs, unstubGlobals }
    = config

  if (restoreMocks) {
    vi.restoreAllMocks()
  }
  if (mockReset) {
    vi.resetAllMocks()
  }
  if (clearMocks) {
    vi.clearAllMocks()
  }

  if (unstubEnvs) {
    vi.unstubAllEnvs()
  }
  if (unstubGlobals) {
    vi.unstubAllGlobals()
  }
}
