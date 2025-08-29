import type { DeferPromise } from '@vitest/utils'
import type { TypecheckResults } from '../../typecheck/typechecker'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { TestProject } from '../project'
import type { TestSpecification } from '../spec'
import type { TestRunEndReason } from '../types/reporter'
import { hasFailed } from '@vitest/runner/utils'
import { createDefer } from '@vitest/utils/helpers'
import { Typechecker } from '../../typecheck/typechecker'
import { groupBy } from '../../utils/base'

export function createTypecheckPool(vitest: Vitest): ProcessPool {
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

    const processError
      = !hasFailed(files) && !sourceErrors.length && checker.getExitCode()
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

  async function collectTests(specs: TestSpecification[]) {
    const specsByProject = groupBy(specs, spec => spec.project.name)
    for (const name in specsByProject) {
      const project = specsByProject[name][0].project
      const files = specsByProject[name].map(spec => spec.moduleId)
      const checker = await createWorkspaceTypechecker(project, files)
      checker.setFiles(files)
      await checker.collectTests()
      const testFiles = checker.getTestFiles()
      vitest.state.collectFiles(project, testFiles)
    }
  }

  async function runTests(specs: TestSpecification[]) {
    const specsByProject = groupBy(specs, spec => spec.project.name)
    const promises: Promise<void>[] = []

    for (const name in specsByProject) {
      const project = specsByProject[name][0].project
      const files = specsByProject[name].map(spec => spec.moduleId)
      const promise = createDefer<void>()
      // check that watcher actually triggered rerun
      const _p = new Promise<boolean>((resolve) => {
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
      const triggered = await _p
      if (project.typechecker && !triggered) {
        const testFiles = project.typechecker.getTestFiles()
        for (const file of testFiles) {
          await vitest._testRun.enqueued(project, file)
        }
        await vitest._testRun.collected(project, testFiles)
        await onParseEnd(project, project.typechecker.getResult())
        continue
      }
      promises.push(promise)
      promisesMap.set(project, promise)
      promises.push(startTypechecker(project, files))
    }

    await Promise.all(promises)
  }

  return {
    name: 'typescript',
    runTests,
    collectTests,
    async close() {
      const promises = vitest.projects.map(project =>
        project.typechecker?.stop(),
      )
      await Promise.all(promises)
    },
  }
}
