import type {
  File as RunnerTestFile,
  TaskEventPack,
  TaskResultPack,
  TaskUpdateEvent,
  TestAnnotation,
  TestAttachment,
} from '@vitest/runner'
import type { TaskEventData } from '@vitest/runner/types/tasks'
import type { SerializedError } from '@vitest/utils'
import type { UserConsoleLog } from '../types/general'
import type { Vitest } from './core'
import type { TestProject } from './project'
import type { ReportedHookContext, TestCase, TestCollection, TestModule } from './reporters/reported-tasks'
import type { TestSpecification } from './spec'
import type { TestRunEndReason } from './types/reporter'
import assert from 'node:assert'
import { createHash } from 'node:crypto'
import { copyFile, mkdir } from 'node:fs/promises'
import { serializeError } from '@vitest/utils/error'
import mime from 'mime/lite'
import { basename, dirname, extname, resolve } from 'pathe'

export class TestRun {
  constructor(private vitest: Vitest) {}

  async start(specifications: TestSpecification[]): Promise<void> {
    const filepaths = specifications.map(spec => spec.moduleId)
    this.vitest.state.collectPaths(filepaths)

    await this.vitest.report('onPathsCollected', Array.from(new Set(filepaths)))
    await this.vitest.report('onSpecsCollected', specifications.map(spec => spec.toJSON()))
    await this.vitest.report('onTestRunStart', [...specifications])
  }

  async enqueued(project: TestProject, file: RunnerTestFile): Promise<void> {
    this.vitest.state.collectFiles(project, [file])
    const testModule = this.vitest.state.getReportedEntity(file) as TestModule
    await this.vitest.report('onTestModuleQueued', testModule)
  }

  async collected(project: TestProject, files: RunnerTestFile[]): Promise<void> {
    this.vitest.state.collectFiles(project, files)
    await Promise.all([
      this.vitest.report('onCollected', files),
      ...files.map((file) => {
        const testModule = this.vitest.state.getReportedEntity(file) as TestModule
        return this.vitest.report('onTestModuleCollected', testModule)
      }),
    ])
  }

  async log(log: UserConsoleLog): Promise<void> {
    this.vitest.state.updateUserLog(log)
    await this.vitest.report('onUserConsoleLog', log)
  }

  async annotate(testId: string, annotation: TestAnnotation): Promise<TestAnnotation> {
    const task = this.vitest.state.idMap.get(testId)
    const entity = task && this.vitest.state.getReportedEntity(task)

    assert(task && entity, `Entity must be found for task ${task?.name || testId}`)
    assert(entity.type === 'test', `Annotation can only be added to a test, instead got ${entity.type}`)

    await this.resolveTestAttachment(entity, annotation)

    entity.task.annotations.push(annotation)

    await this.vitest.report('onTestCaseAnnotate', entity, annotation)
    return annotation
  }

  async updated(update: TaskResultPack[], events: TaskEventPack[]): Promise<void> {
    this.vitest.state.updateTasks(update)

    for (const [id, event, data] of events) {
      await this.reportEvent(id, event, data).catch((error) => {
        this.vitest.state.catchError(serializeError(error), 'Unhandled Reporter Error')
      })
    }

    // TODO: what is the order or reports here?
    // "onTaskUpdate" in parallel with others or before all or after all?
    // TODO: error handling - what happens if custom reporter throws an error?
    await this.vitest.report('onTaskUpdate', update, events)
  }

  async end(specifications: TestSpecification[], errors: unknown[], coverage?: unknown): Promise<void> {
    // specification won't have the File task if they were filtered by the --shard command
    const modules = specifications.map(spec => spec.testModule).filter(s => s != null)
    const files = modules.map(m => m.task)

    const state: TestRunEndReason = this.vitest.isCancelling
      ? 'interrupted'
      // by this point, the run will be marked as failed if there are any errors,
      // should it be done by testRun.end?
      : this.hasFailed(modules)
        ? 'failed'
        : 'passed'

    if (state !== 'passed') {
      process.exitCode = 1
    }

    try {
      await Promise.all([
        this.vitest.report('onTestRunEnd', modules, [...errors] as SerializedError[], state),
        // TODO: in a perfect world, the coverage should be done in parallel to `onFinished`
        this.vitest.report('onFinished', files, errors, coverage),
      ])
    }
    finally {
      if (coverage) {
        await this.vitest.report('onCoverage', coverage)
      }
    }
  }

  private hasFailed(modules: TestModule[]) {
    if (!modules.length) {
      return !this.vitest.config.passWithNoTests
    }

    return modules.some(m => !m.ok())
  }

  private async reportEvent(id: string, event: TaskUpdateEvent, data: TaskEventData | undefined) {
    const task = this.vitest.state.idMap.get(id)
    const entity = task && this.vitest.state.getReportedEntity(task)

    assert(task && entity, `Entity must be found for task ${task?.name || id}`)

    if (event === 'suite-prepare' && entity.type === 'suite') {
      return await this.vitest.report('onTestSuiteReady', entity)
    }

    if (event === 'suite-prepare' && entity.type === 'module') {
      return await this.vitest.report('onTestModuleStart', entity)
    }

    if (event === 'suite-finished') {
      assert(entity.type === 'suite' || entity.type === 'module', 'Entity type must be suite or module')

      if (entity.state() === 'skipped') {
        // everything inside suite or a module is skipped,
        // so we won't get any children events
        // we need to report everything manually
        await this.reportChildren(entity.children)
      }

      if (entity.type === 'module') {
        await this.vitest.report('onTestModuleEnd', entity)
      }
      else {
        await this.vitest.report('onTestSuiteResult', entity)
      }

      return
    }

    if (event === 'test-prepare' && entity.type === 'test') {
      return await this.vitest.report('onTestCaseReady', entity)
    }

    if (event === 'test-finished' && entity.type === 'test') {
      return await this.vitest.report('onTestCaseResult', entity)
    }

    if (event.startsWith('before-hook') || event.startsWith('after-hook')) {
      const isBefore = event.startsWith('before-hook')

      const hook: ReportedHookContext = entity.type === 'test'
        ? {
            name: isBefore ? 'beforeEach' : 'afterEach',
            entity,
          }
        : {
            name: isBefore ? 'beforeAll' : 'afterAll',
            entity,
          }

      if (event.endsWith('-start')) {
        await this.vitest.report('onHookStart', hook)
      }
      else {
        await this.vitest.report('onHookEnd', hook)
      }

      // this can only happen in --merge-reports, and annotation is already resolved
      if (event === 'test-annotation') {
        const annotation = data?.annotation
        assert(annotation && entity.type === 'test')
        await this.vitest.report('onTestCaseAnnotate', entity, annotation)
      }
    }
  }

  private async resolveTestAttachment(test: TestCase, annotation: TestAnnotation): Promise<TestAttachment | undefined> {
    const project = test.project
    const attachment = annotation.attachment
    if (!attachment) {
      return attachment
    }
    const path = attachment.path
    if (path && !path.startsWith('http://') && !path.startsWith('https://')) {
      const currentPath = resolve(project.config.root, path)
      const hash = createHash('sha1').update(currentPath).digest('hex')
      const newPath = resolve(
        project.config.attachmentsDir,
        `${sanitizeFilePath(annotation.message)}-${hash}${extname(currentPath)}`,
      )
      await mkdir(dirname(newPath), { recursive: true })
      await copyFile(currentPath, newPath)

      attachment.path = newPath
      const contentType = attachment.contentType ?? mime.getType(basename(currentPath))
      attachment.contentType = contentType || undefined
    }
    return attachment
  }

  private async reportChildren(children: TestCollection) {
    for (const child of children) {
      if (child.type === 'test') {
        await this.vitest.report('onTestCaseReady', child)
        await this.vitest.report('onTestCaseResult', child)
      }
      else {
        await this.vitest.report('onTestSuiteReady', child)
        await this.reportChildren(child.children)
        await this.vitest.report('onTestSuiteResult', child)
      }
    }
  }
}

function sanitizeFilePath(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x2C\x2E\x2F\x3A-\x40\x5B-\x60\x7B-\x7F]+/g, '-')
}
