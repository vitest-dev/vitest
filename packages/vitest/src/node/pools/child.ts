import v8 from 'node:v8'
import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import type { ContextTestEnvironment, ResolvedConfig, RuntimeRPC, Vitest } from '../../types'
import type { ChildContext } from '../../types/child'
import type { PoolProcessOptions, ProcessPool, WorkspaceSpec } from '../pool'
import { distDir } from '../../paths'
import { groupBy } from '../../utils/base'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import type { VitestWorkspace } from '../workspace'
import { createMethodsRPC } from './rpc'

const childPath = fileURLToPath(pathToFileURL(resolve(distDir, './child.js')).href)

function setupChildProcessChannel(workspace: VitestWorkspace, fork: ChildProcess): void {
  createBirpc<{}, RuntimeRPC>(
    createMethodsRPC(workspace),
    {
      serialize: v8.serialize,
      deserialize: v => v8.deserialize(Buffer.from(v)),
      post(v) {
        fork.send(v)
      },
      on(fn) {
        fork.on('message', fn)
      },
    },
  )
}

function stringifyRegex(input: RegExp | string): string {
  if (typeof input === 'string')
    return input
  return `$$vitest:${input.toString()}`
}

function getTestConfig(ctx: VitestWorkspace): ResolvedConfig {
  const config = ctx.getSerializableConfig()
  // v8 serialize does not support regex
  return <ResolvedConfig>{
    ...config,
    testNamePattern: config.testNamePattern
      ? stringifyRegex(config.testNamePattern)
      : undefined,
  }
}

export function createChildProcessPool(ctx: Vitest, { execArgv, env }: PoolProcessOptions): ProcessPool {
  const children = new Set<ChildProcess>()

  const Sequencer = ctx.config.sequence.sequencer
  const sequencer = new Sequencer(ctx)

  function runFiles(workspace: VitestWorkspace, files: string[], environment: ContextTestEnvironment, invalidates: string[] = []) {
    const config = getTestConfig(workspace)
    ctx.state.clearFiles(workspace, files)

    const data: ChildContext = {
      command: 'start',
      config,
      files,
      invalidates,
      environment,
    }

    const child = fork(childPath, [], {
      execArgv,
      env,
    })
    children.add(child)
    setupChildProcessChannel(workspace, child)

    return new Promise<void>((resolve, reject) => {
      child.send(data, (err) => {
        if (err)
          reject(err)
      })
      child.on('close', (code) => {
        if (!code)
          resolve()
        else
          reject(new Error(`Child process exited unexpectedly with code ${code}`))

        children.delete(child)
      })
    })
  }

  async function runTests(specs: WorkspaceSpec[], invalidates: string[] = []): Promise<void> {
    const { shard } = ctx.config

    if (shard)
      specs = await sequencer.shard(specs)

    specs = await sequencer.sort(specs)

    const filesByEnv = await groupFilesByEnv(specs)
    const envs = envsOrder.concat(
      Object.keys(filesByEnv).filter(env => !envsOrder.includes(env)),
    )

    // always run environments isolated between each other
    for (const env of envs) {
      const files = filesByEnv[env]

      if (!files?.length)
        continue

      const filesByOptions = groupBy(files, ({ workspace, environment }) => workspace.getName() + JSON.stringify(environment.options))

      for (const option in filesByOptions) {
        const files = filesByOptions[option]

        if (files?.length) {
          const filenames = files.map(f => f.file)
          await runFiles(files[0].workspace, filenames, files[0].environment, invalidates)
        }
      }
    }
  }

  return {
    runTests,
    async close() {
      children.forEach((child) => {
        if (!child.killed)
          child.kill()
      })
      children.clear()
    },
  }
}
