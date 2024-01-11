import type { DeferPromise } from '@vitest/utils'
import { createDefer } from '@vitest/utils'
import type { TypecheckResults } from '../../typecheck/typechecker'
import { Typechecker } from '../../typecheck/typechecker'
import { groupBy } from '../../utils/base'
import { hasFailed } from '../../utils/tasks'
import type { Vitest } from '../core'
import type { ProcessPool, WorkspaceSpec } from '../pool'
import type { WorkspaceProject } from '../workspace'

export function createTypecheckPool(ctx: Vitest): ProcessPool {
  const promisesMap = new WeakMap<WorkspaceProject, DeferPromise<void>>()
  const rerunTriggered = new WeakMap<WorkspaceProject, boolean>()

  async function onParseEnd(project: WorkspaceProject, { files, sourceErrors }: TypecheckResults) {
    const checker = project.typechecker!

    await ctx.report('onTaskUpdate', checker.getTestPacks())

    if (!project.config.typecheck.ignoreSourceErrors)
      sourceErrors.forEach(error => ctx.state.catchError(error, 'Unhandled Source Error'))

    const processError = !hasFailed(files) && checker.getExitCode()
    if (processError) {
      const error = new Error(checker.getOutput())
      error.stack = ''
      ctx.state.catchError(error, 'Typecheck Error')
    }

    promisesMap.get(project)?.resolve()

    rerunTriggered.set(project, false)

    // triggered by TSC watcher, not Vitest watcher, so we need to emulate what Vitest does in this case
    if (ctx.config.watch && !ctx.runningPromise) {
      await ctx.report('onFinished', files)
      await ctx.report('onWatcherStart', files, [
        ...(project.config.typecheck.ignoreSourceErrors ? [] : sourceErrors),
        ...ctx.state.getUnhandledErrors(),
      ])
    }
  }

  async function createWorkspaceTypechecker(project: WorkspaceProject, files: string[]) {
    const checker = project.typechecker ?? new Typechecker(project)
    if (project.typechecker)
      return checker

    project.typechecker = checker
    checker.setFiles(files)

    checker.onParseStart(async () => {
      ctx.state.collectFiles(checker.getTestFiles())
      await ctx.report('onCollected')
    })

    checker.onParseEnd(result => onParseEnd(project, result))

    checker.onWatcherRerun(async () => {
      rerunTriggered.set(project, true)

      if (!ctx.runningPromise) {
        ctx.state.clearErrors()
        await ctx.report('onWatcherRerun', files, 'File change detected. Triggering rerun.')
      }

      await checker.collectTests()
      ctx.state.collectFiles(checker.getTestFiles())

      await ctx.report('onTaskUpdate', checker.getTestPacks())
      await ctx.report('onCollected')
    })

    await checker.prepare()
    await checker.collectTests()
    checker.start()
    return checker
  }

  async function runTests(specs: WorkspaceSpec[]) {
    const specsByProject = groupBy(specs, ([project]) => project.getName())
    const promises: Promise<void>[] = []

    for (const name in specsByProject) {
      const project = specsByProject[name][0][0]
      const files = specsByProject[name].map(([_, file]) => file)
      const promise = createDefer<void>()
      // check that watcher actually triggered rerun
      const _p = new Promise<boolean>((resolve) => {
        const _i = setInterval(() => {
          if (!project.typechecker || rerunTriggered.get(project)) {
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
        ctx.state.collectFiles(project.typechecker.getTestFiles())
        await ctx.report('onCollected')
        await onParseEnd(project, project.typechecker.getResult())
        continue
      }
      promises.push(promise)
      promisesMap.set(project, promise)
      createWorkspaceTypechecker(project, files)
    }

    await Promise.all(promises)
  }

  return {
    name: 'typescript',
    runTests,
    async close() {
      const promises = ctx.projects.map(project => project.typechecker?.stop())
      await Promise.all(promises)
    },
  }
}
