import fs from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runInlineTests, runVitest, ts } from '../../test-utils'

function isProcessRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}

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
        import { resolve } from 'node:path'

        export default {
          test: {
            typecheck: {
              enabled: true,
              only: true,
              checker: resolve(
                import.meta.dirname,
                process.platform === 'win32' ? 'fake-checker.cmd' : 'fake-checker.mjs',
              ),
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
        writeFileSync(resolve(process.cwd(), 'checker-child.pid'), String(child.pid))
        process.stdout.write('Found 0 errors. Watching for file changes.\n')
        setInterval(() => {}, 1_000)
      `,
      'test/foo.test-d.ts': '',
    }, {
      watch: true,
    })

    const pidFile = resolve(root, 'checker-child.pid')
    await expect.poll(() => fs.existsSync(pidFile), { timeout: 5000 }).toBe(true)
    const childPid = Number(fs.readFileSync(pidFile, 'utf8'))

    try {
      expect(isProcessRunning(childPid)).toBe(true)
      await ctx!.close()
      await expect.poll(() => isProcessRunning(childPid), { timeout: 5000 }).toBe(false)
    }
    finally {
      if (isProcessRunning(childPid)) {
        process.kill(childPid)
      }
    }
  })
})
