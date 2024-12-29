import type { DeferPromise } from '@vitest/utils'
import type { TypecheckResults } from '../../typecheck/typechecker'
import type { Vitest } from '../core'
import type { ProcessPool } from '../pool'
import type { TestProject } from '../project'
import type { TestSpecification } from '../spec'
import { hasFailed } from '@vitest/runner/utils'
import { createDefer } from '@vitest/utils'
import { Typechecker } from '../../typecheck/typechecker'
import { groupBy } from '../../utils/base'

export function createTypecheckPool(ctx: Vitest): ProcessPool {
  const promisesMap = new WeakMap<TestProject, DeferPromise<void>>()
  const rerunTriggered = new WeakSet<TestProject>()

  async function onParseEnd(
    project: TestProject,
    { files, sourceErrors }: TypecheckResults,
  ) {
    const checker = project.typechecker!

    await ctx.report('onTaskUpdate', checker.getTestPacks())

    if (!project.config.typecheck.ignoreSourceErrors) {
      sourceErrors.forEach(error =>
        ctx.state.catchError(error, 'Unhandled Source Error'),
      )
    }

    const processError
      = !hasFailed(files) && !sourceErrors.length && checker.getExitCode()
    if (processError) {
      const error = new Error(checker.getOutput())
      error.stack = ''
      ctx.state.catchError(error, 'Typecheck Error')
    }

    promisesMap.get(project)?.resolve()

    rerunTriggered.delete(project)

    // triggered by TSC watcher, not Vitest watcher, so we need to emulate what Vitest does in this case
    if (ctx.config.watch && !ctx.runningPromise) {
      await ctx.report('onFinished', files, [])
      await ctx.report('onWatcherStart', files, [
        ...(project.config.typecheck.ignoreSourceErrors ? [] : sourceErrors),
        ...ctx.state.getUnhandledErrors(),
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
      ctx.state.collectFiles(project, checker.getTestFiles())
      await ctx.report('onCollected')
    })

    checker.onParseEnd(result => onParseEnd(project, result))

    checker.onWatcherRerun(async () => {
      rerunTriggered.add(project)

      if (!ctx.runningPromise) {
        ctx.state.clearErrors()
        await ctx.report(
          'onWatcherRerun',
          files,
          'File change detected. Triggering rerun.',
        )
      }

      await checker.collectTests()
      ctx.state.collectFiles(project, checker.getTestFiles())

      await ctx.report('onTaskUpdate', checker.getTestPacks())
      await ctx.report('onCollected')
    })

    await checker.prepare()
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
      ctx.state.collectFiles(project, checker.getTestFiles())
      await ctx.report('onCollected')
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
        ctx.state.collectFiles(project, project.typechecker.getTestFiles())
        await ctx.report('onCollected')
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
      const promises = ctx.projects.map(project =>
        project.typechecker?.stop(),
      )
      await Promise.all(promises)
    },
  }
}
