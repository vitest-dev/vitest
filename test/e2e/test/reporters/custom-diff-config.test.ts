import { runVitest } from '#test-utils'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'

test('custom diff config', async () => {
  const filename = resolve('./fixtures/reporters/custom-diff-config.test.ts')
  const diff = resolve('./fixtures/reporters/custom-diff-config.ts')
  const { stderr } = await runVitest({ root: './fixtures/reporters', diff }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('Expected to be')
  expect(stderr).toContain('But got')
})

test('invalid diff config file', async () => {
  const filename = resolve('./fixtures/reporters/custom-diff-config.test.ts')
  const diff = resolve('./fixtures/reporters/invalid-diff-config.ts')
  const { stderr } = await runVitest({ root: './fixtures/reporters', diff }, [filename])

  expect(stderr).toBeTruthy()
  expect(stderr).toContain('invalid diff config file')
  expect(stderr).toContain('Must have a default export with config object')
})

// https://github.com/vitest-dev/vitest/issues/8663
// An inline `diff` object may carry non-serializable color functions. They must
// be stripped before the config is sent to workers, otherwise the `threads`
// pool throws a `DataCloneError` (structured clone) and the `forks` pool drops
// them over IPC. The serializable annotations must still be applied.
test.each(['forks', 'threads'] as const)(
  'inline diff config object with color functions works in %s pool',
  async (pool) => {
    const filename = resolve('./fixtures/reporters/custom-diff-config.test.ts')
    const { stderr } = await runVitest({
      root: './fixtures/reporters',
      pool,
      diff: {
        aAnnotation: 'Expected to be',
        bAnnotation: 'But got',
        // @ts-expect-error color functions are not part of the public diff type,
        // but users pass them at runtime — this is what used to crash the worker.
        aColor: (s: string) => s,
      },
    }, [filename])

    expect(stderr).not.toContain('could not be cloned')
    expect(stderr).not.toContain('DataCloneError')
    expect(stderr).toContain('Expected to be')
    expect(stderr).toContain('But got')
  },
)
