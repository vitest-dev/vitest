import EventEmitter from 'node:events'
import { createBirpc } from 'birpc'
import { parse, stringify } from 'flatted'
import type { Vitest } from '../core'
import type { ProcessPool, WorkspaceSpec } from '../pool'
import { runRealmTests } from '../../runtime/bun/runRealmTests'
import { createShadowRealm } from '../../runtime/bun/utils'
import type { ShadowRealmContext } from '../../types/worker'
import { groupBy } from '../../utils/base'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import type { WorkspaceProject } from '../workspace'
import type { ContextTestEnvironment, RunnerRPC, RuntimeRPC } from '../../types/rpc'
import { createMethodsRPC } from './rpc'

// this is experimental pool to run tests in Shadow Realms without spinning up workers or child processes
// it should be replaced with threads pool when workers/child_process is stable in Bun
export function createRealmsPool(ctx: Vitest): ProcessPool {
  async function runFiles(project: WorkspaceProject, files: string[], environment: ContextTestEnvironment, invalidates?: string[]) {
    const mainPort = new EventEmitter()
    const childPort = new EventEmitter()

    const rpc = createBirpc<RunnerRPC, RuntimeRPC>(
      createMethodsRPC(project),
      {
        eventNames: ['onCancel'],
        post(v) {
          childPort.emit('message', v)
        },
        on(fn) {
          mainPort.on('message', fn)
        },
        serialize: stringify,
        deserialize: parse,
      },
    )

    project.ctx.onCancel(reason => rpc.onCancel(reason))

    const data: ShadowRealmContext = {
      config: project.getSerializableConfig(),
      files,
      invalidates,
      environment,
    }

    if (data.config.isolate)
      ctx.logger.error('[warning] `isolate` option is not supported in Bun yet. To hide this message, pass down `false` to `isolate` flag manually.')

    const realm = createShadowRealm()
    try {
      await runRealmTests(
        realm,
        data,
        (v: string) => { mainPort.emit('message', v) },
        (fn: (data: string) => void) => { childPort.on('message', fn) },
      )
    }
    catch (error) {
      // Intentionally cancelled
      if (ctx.isCancelling && error instanceof Error && /The task has been cancelled/.test(error.message))
        ctx.state.cancelFiles(files, ctx.config.root)

      else
        throw error
    }
    finally {
      mainPort.removeAllListeners()
      childPort.removeAllListeners()
    }
  }

  async function runTests(specs: WorkspaceSpec[], invalidates?: string[]) {
    // currently "isolate" is not supported because Workers are not fully supported in Bun,
    // so when we try to create a new realm for each test, the whole suite runs longer than in Node.js

    const filesByEnv = await groupFilesByEnv(specs)
    const envs = envsOrder.concat(
      Object.keys(filesByEnv).filter(env => !envsOrder.includes(env)),
    )

    for (const env of envs) {
      const files = filesByEnv[env]

      if (!files?.length)
        continue

      const filesByOptions = groupBy(files, ({ project, environment }) => project.getName() + JSON.stringify(environment.options))

      for (const files of Object.values(filesByOptions)) {
        const filenames = files.map(f => f.file)
        await runFiles(files[0].project, filenames, files[0].environment, invalidates)
      }
    }
  }

  return {
    runTests,
    async close() {
      // TODO?
    },
  }
}
