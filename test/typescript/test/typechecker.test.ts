import { chmodSync, existsSync, readFileSync } from 'node:fs'
import { resolve } from 'pathe'
import { describe, expect, it, onTestFinished } from 'vitest'
import { runVitest, ts, useTmpFS } from '../../test-utils'

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

  it('stops the watching checker when Vitest closes', async () => {
    const fs = useTmpFS({
      'fake-tsc.cmd': '@node "%~dp0fake-tsc.mjs" %*',
      'fake-tsc.mjs': ts`#!/usr/bin/env node
        import { writeFileSync } from 'node:fs'

        writeFileSync('checker.pid', String(process.pid))
        console.log('Found 0 errors. Watching for file changes.')
        setInterval(() => {}, 1000)
      `,
      'basic.test-d.ts': ts`
        import { expectTypeOf, test } from 'vitest'

        test('number', () => {
          expectTypeOf(1).toEqualTypeOf<number>()
        })
      `,
    })
    chmodSync(fs.resolveFile('fake-tsc.mjs'), 0o755)

    const { ctx, stderr } = await runVitest({
      root: fs.root,
      watch: true,
      typecheck: {
        enabled: true,
        only: true,
        checker: fs.resolveFile(process.platform === 'win32' ? 'fake-tsc.cmd' : 'fake-tsc.mjs'),
      },
    })

    const pidFile = fs.resolveFile('checker.pid')
    await expect.poll(() => existsSync(pidFile)).toBe(true)
    const pid = Number(readFileSync(pidFile, 'utf-8'))
    onTestFinished(() => {
      if (isRunning(pid)) {
        process.kill(pid)
      }
    })
    expect(isRunning(pid)).toBe(true)

    await ctx!.close()

    await expect.poll(() => isRunning(pid)).toBe(false)
    expect(stderr).toBe('')
  })
})

function isRunning(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}
