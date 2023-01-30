import v8 from 'node:v8'
import type { ChildProcess } from 'node:child_process'
import { fork } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createBirpc } from 'birpc'
import { resolve } from 'pathe'
import type { RuntimeRPC } from '../../types'
import type { Vitest } from '../core'
import type { ChildContext } from '../../types/child'
import type { PoolProcessOptions, ProcessPool } from '../pool'
import { distDir } from '../../constants'
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

export function createChildProcessPool(ctx: Vitest, { execArgv, env }: PoolProcessOptions): ProcessPool {
  // isolation is disabled with --no-threads
  let child: ChildProcess

  ctx.coverageProvider?.onBeforeFilesRun?.()

  // in case onBeforeFilesRun changes env
  const resolvedEnv = {
    ...env,
    ...process.env,
  }

  function runWithFiles(files: string[], invalidates: string[] = []) {
    const data: ChildContext = {
      command: 'start',
      config: ctx.getSerializableConfig(),
      files,
      invalidates,
    }
    child = fork(childPath, [], {
      execArgv,
      env: resolvedEnv,
    })
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
      })
    })
  }

  return {
    runTests: runWithFiles,
    async close() {
      if (!child)
        return

      if (!child.killed)
        child.kill()
    },
  }
}
