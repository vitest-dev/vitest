import { pathToFileURL } from 'node:url'
import EventEmitter from 'node:events'
import { resolve } from 'pathe'
import { parse, stringify } from 'flatted'
import { createBirpc } from 'birpc'
import { createDefer } from '@vitest/utils'
import type { Vitest } from '../core'
import type { ProcessPool, WorkspaceSpec } from '../pool'
import type { WorkspaceProject } from '../workspace'
import { distDir } from '../../paths'
import type { ContextTestEnvironment, ResolvedConfig, ShadowRealmContext } from '../../types'
import { groupFilesByEnv } from '../../utils/test-helpers'
import { createMethodsRPC } from './rpc'

declare class ShadowRealm {
  constructor()
  importValue(specifier: string, bindingName: string): Promise<unknown>
  evaluate(sourceText: string): unknown
}

const realmEntryPath = pathToFileURL(resolve(distDir, './shadow-realm.js')).href

export function createShadowRealmPool(ctx: Vitest): ProcessPool {
  if (typeof ShadowRealm === 'undefined')
    throw new Error('ShadowRealm is not supported in this environment. Please, use "bun" with this pool.')

  async function runFiles(project: WorkspaceProject, config: ResolvedConfig, files: string[], environment: ContextTestEnvironment, invalidates?: string[]) {
    ctx.state.clearFiles(project, files)
    const mainPort = new EventEmitter()
    const childPort = new EventEmitter()
    createBirpc(
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
    const data: ShadowRealmContext = {
      config,
      files,
      invalidates,
      environment,
    }
    const realm = new ShadowRealm()
    const run = await realm.importValue(realmEntryPath, 'run') as any
    const promise = createDefer<void>()
    try {
      run(
        stringify(data),
        (v: string) => { mainPort.emit('message', v) },
        (fn: (data: string) => void) => { childPort.on('message', fn) },
        () => promise.resolve(),
        (err: string) => promise.reject(parse(err)),
      )
      await promise
    }
    catch (error) {
      if (ctx.isCancelling && error instanceof Error && /The task has been cancelled/.test(error.message))
        ctx.state.cancelFiles(files, ctx.config.root)
      else
        throw error
    }
  }

  async function runTests(specs: WorkspaceSpec[], invalidates?: string[]) {
    const configs = new Map<WorkspaceProject, ResolvedConfig>()
    const getConfig = (project: WorkspaceProject): ResolvedConfig => {
      if (configs.has(project))
        return configs.get(project)!

      const config = project.getSerializableConfig()
      configs.set(project, config)
      return config
    }

    const filesByEnv = await groupFilesByEnv(specs)
    const files = Object.values(filesByEnv).flat()
    const results: PromiseSettledResult<void>[] = []

    results.push(...await Promise.allSettled(files.map(({ file, environment, project }) =>
      runFiles(project, getConfig(project), [file], environment, invalidates))))

    const errors = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected').map(r => r.reason)
    if (errors.length > 0)
      throw new AggregateError(errors, 'Errors occurred while running tests. For more information, see serialized error.')
  }

  return {
    async close() {
      // TODO
    },
    runTests,
  }
}
