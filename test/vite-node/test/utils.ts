import type { Readable, Writable } from 'stream'
import type { ExecaChildProcess } from 'execa'
import { execa } from 'execa'
import { resolve } from 'pathe'
import { expect } from 'vitest'
import fs from 'fs-extra'
import type { TestContext } from '#types'

export const cliPath = resolve(__dirname, '../../../packages/vite-node/src/cli.ts')
const rootDir = resolve(__dirname, '../../..')

export interface ExecaContext {
  childProcess: ExecaChildProcess
  stdout: Readable
  stderr: Readable
  stdin: Writable
}

export function setupTestFixture(srcDir: string, fixtureDir: string, args: string[] = []) {
  return async (context: ExecaContext & TestContext) => {
    const srcExists = await fs.pathExists(srcDir)
    if (!srcExists)
      throw new Error(`Does folder ${srcDir} exist?`)

    await fs.copy(srcDir, fixtureDir, {
      overwrite: true,
    })

    const childProcess = execa('npx', ['esno', cliPath, ...args])

    context.childProcess = childProcess

    expect(childProcess.stdout).toBeDefined()
    context.stdout = childProcess.stdout!

    expect(childProcess.stderr).toBeDefined()
    context.stderr = childProcess.stderr!

    expect(childProcess.stdin).toBeDefined()
    context.stdin = childProcess.stdin!

    return async () => {
      childProcess.kill()

      await fs.remove(fixtureDir)
    }
  }
}

/**
 * Waits for the next 'data' event from the stream
 * @param stream
 * @returns value trimmed and replacing the root of this project with the value <rootDir>
 */
export function readNextData(stream: Readable) {
  return new Promise<string>((resolve) => {
    stream.once('data', (value) => {
      resolve(`${value}`.trim().replace(rootDir, '<rootDir>'))
    })
  })
}
