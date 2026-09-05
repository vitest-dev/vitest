import fs from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, it, onTestFinished } from 'vitest'
import { runInlineTests, runVitest, ts } from '../../test-utils'

describe('Typechecker', () => {
  it('handles non-existing typechecker command gracefully', async () => {
    const { stderr } = await runVitest({
      root: resolve(import.meta.dirname, '../fixtures/source-error'),
      typecheck: {
        enabled: true,
        checker: 'non-existing-tsc-command',
      },
    })

    // Should show proper error when typechecker doesn't exist
    expect(stderr).toContain('Spawning typechecker failed')
  })

  it('fails the run when the typechecker crashes (OOM) instead of reporting a false green', async () => {
    const { stderr, exitCode } = await runVitest({
      root: resolve(import.meta.dirname, '../fixtures/typecheck-crash'),
      typecheck: {
        enabled: true,
        checker: resolve(
          import.meta.dirname,
          // Windows can't execute an .mjs file, the .cmd shim runs it with node
          process.platform === 'win32'
            ? '../fixtures/typecheck-crash/fake-tsc.cmd'
            : '../fixtures/typecheck-crash/fake-tsc.mjs',
        ),
      },
    })

    // A checker that aborts (OOM) without producing diagnostics must NOT be
    // reported as passing — the run has to fail with a clear error. The abort
    // surfaces as a signal (SIGABRT) on POSIX and as a non-zero exit code on
    // Windows; both paths must be treated as an abnormal, failing exit.
    expect(exitCode).toBe(1)
    expect(stderr).toContain('Typecheck Error')
    expect(stderr).toContain('before type checking finished')
    expect(stderr).toContain('ran out of memory')
  })

  it('stops the typechecker process tree', async () => {
    const { ctx, root } = await runInlineTests({
      'vitest.config.mjs': ts`
        import { chmodSync } from 'node:fs'
        import { resolve } from 'node:path'

        const checker = resolve(
          import.meta.dirname,
          process.platform === 'win32' ? 'fake-checker.cmd' : 'fake-checker.mjs',
        )
        if (process.platform !== 'win32') {
          chmodSync(checker, 0o755)
        }

        export default {
          test: {
            typecheck: {
              enabled: true,
              only: true,
              checker,
            },
          },
        }
      `,
      'fake-checker.cmd': '@node "%~dp0fake-checker.mjs" %*',
      'fake-checker.mjs': ts`#!/usr/bin/env node
        import { spawn } from 'node:child_process'
        import { writeFileSync } from 'node:fs'
        import { resolve } from 'node:path'

        const child = spawn(
          process.execPath,
          ['-e', 'setInterval(() => {}, 1_000)'],
          { stdio: 'inherit' },
        )
        writeFileSync(
          resolve(process.cwd(), 'checker-pids.json'),
          JSON.stringify([process.pid, child.pid]),
        )
        process.stdout.write('Found 0 errors. Watching for file changes.\n')
        setInterval(() => {}, 1_000)
      `,
      'test/foo.test-d.ts': '',
    }, {
      watch: true,
    })

    const pidFile = resolve(root, 'checker-pids.json')
    let pids: number[] = []
    onTestFinished(() => {
      for (const pid of pids.reverse()) {
        if (isProcessAlive(pid)) {
          process.kill(pid)
        }
      }
    })

    await expect.poll(() => {
      pids = readPids(pidFile)
      return pids
    }, { timeout: 5000 }).toHaveLength(2)

    expect(pids.map(isProcessAlive)).toEqual([true, true])
    await ctx!.close()
    await expect.poll(
      () => pids.map(isProcessAlive),
      { timeout: 5000 },
    ).toEqual([false, false])
  })
})

function isProcessAlive(pid: number): boolean {
  try {
    // Sending signal 0 checks if the process exists without actually killing it:
    // https://nodejs.org/api/process.html#processkillpid-signal
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    // ESRCH means the process is gone. Treat anything else (e.g. EPERM) as alive
    // so we never reclaim a lock from a process that is still running.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH'
  }
}

function readPids(pidFile: string) {
  try {
    const pids = JSON.parse(fs.readFileSync(pidFile, 'utf8'))
    if (
      Array.isArray(pids)
      && pids.length === 2
      && pids.every((pid): pid is number => Number.isInteger(pid) && pid > 0)
    ) {
      return pids
    }
  }
  catch {
    // The checker may still be writing the file.
  }
  return []
}
