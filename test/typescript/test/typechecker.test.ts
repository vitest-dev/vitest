import { resolve } from 'pathe'
import { describe, expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

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
})
