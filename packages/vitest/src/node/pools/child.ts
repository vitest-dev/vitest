import v8 from 'node:v8'
import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import type { ContextTestEnvironment, ResolvedConfig, RuntimeRPC } from '../../types'
import type { Vitest } from '../core'
import type { ChildContext } from '../../types/child'
import type { PoolProcessOptions, ProcessPool } from '../pool'
import { distDir } from '../../constants'
import { groupBy } from '../../utils/base'
import { envsOrder, groupFilesByEnv } from '../../utils/test-helpers'
import { createMethodsRPC } from './rpc'

const childPath = fileURLToPath(pathToFileURL(resolve(distDir, './child.js')).href)

function setupChildProcessChannel(ctx: Vitest, fork: ChildProcess) {
  createBirpc<{}, RuntimeRPC>(
    createMethodsRPC(ctx),
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

function stringifyRegex(input: RegExp | string): any {
  if (typeof input === 'string')
    return input
  return `$$vitest:${input.toString()}`
}

function getTestConfig(ctx: Vitest) {
  const config = ctx.getSerializableConfig()
  // v8 serialize does not support regex
  return {
    ...config,
    testNamePattern: config.testNamePattern
      ? stringifyRegex(config.testNamePattern)
      : undefined,
  }
}

export function createChildProcessPool(ctx: Vitest, { execArgv, env }: PoolProcessOptions): ProcessPool {
  const children = new Set<ChildProcess>()

  function runFiles(config: ResolvedConfig, files: string[], environment: ContextTestEnvironment, invalidates: string[] = []) {
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
    setupChildProcessChannel(ctx, child)

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

  async function runWithFiles(files: string[], invalidates: string[] = []) {
    ctx.state.clearFiles(files)
    const config = getTestConfig(ctx)

    const filesByEnv = await groupFilesByEnv(files, config)
    const envs = envsOrder.concat(
      Object.keys(filesByEnv).filter(env => !envsOrder.includes(env)),
    )

    // always run environments isolated between each other
    for (const env of envs) {
      const files = filesByEnv[env]

      if (!files?.length)
        continue

      const filesByOptions = groupBy(files, ({ environment }) => JSON.stringify(environment.options))

      for (const option in filesByOptions) {
        const files = filesByOptions[option]

        if (files?.length) {
          const filenames = files.map(f => f.file)
          await runFiles(config, filenames, files[0].environment, invalidates)
        }
      }
    }
  }

  return {
    runTests: runWithFiles,
    async close() {
      children.forEach((child) => {
        if (!child.killed)
          child.kill()
      })
    },
  }
}
