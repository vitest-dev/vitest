import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

function extractLogs(stdout: string): string {
  return stdout
    .split('\n')
    .filter((l) => l.includes('>>'))
    .join('\n')
}

test.for(['stack', 'list', 'parallel'] as const)(
  'runs the cleanup of a resolved hook if a later hook fails with sequence.hooks: %s',
  async (hooks) => {
    const { stdout, errorTree } = await runInlineTests(
      {
        'basic.test.js': `
          import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'vitest'

          describe('beforeAll', () => {
            beforeAll(async () => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              console.log('>> beforeAll resolved')
              return () => console.log('>> beforeAll cleanup')
            })
            beforeAll(() => {
              throw new Error('beforeAll fails')
            })
            afterAll(() => console.log('>> afterAll'))
            test('skipped', () => {})
          })

          describe('beforeEach', () => {
            beforeEach(async () => {
              await new Promise((resolve) => setTimeout(resolve, 10))
              console.log('>> beforeEach resolved')
              return () => console.log('>> beforeEach cleanup')
            })
            beforeEach(() => {
              throw new Error('beforeEach fails')
            })
            afterEach(() => console.log('>> afterEach'))
            test('fails', () => {})
          })
        `,
      },
      { sequence: { hooks } },
    )

    expect(extractLogs(stdout)).toMatchInlineSnapshot(`
      ">> beforeAll resolved
      >> afterAll
      >> beforeAll cleanup
      >> beforeEach resolved
      >> afterEach
      >> beforeEach cleanup"
    `)
    expect(errorTree()).toMatchInlineSnapshot(`
      {
        "basic.test.js": {
          "beforeAll": {
            "__suite_errors__": [
              "beforeAll fails",
            ],
            "skipped": "skipped",
          },
          "beforeEach": {
            "fails": [
              "beforeEach fails",
            ],
          },
        },
      }
    `)
  },
)

test('reports every failed hook with sequence.hooks: parallel', async () => {
  const { errorTree } = await runInlineTests(
    {
      'basic.test.js': `
        import { beforeAll, beforeEach, describe, test } from 'vitest'

        describe('beforeAll', () => {
          beforeAll(() => {
            throw new Error('first beforeAll fails')
          })
          beforeAll(() => {
            throw new Error('second beforeAll fails')
          })
          test('skipped', () => {})
        })

        describe('beforeEach', () => {
          beforeEach(() => {
            throw new Error('first beforeEach fails')
          })
          beforeEach(() => {
            throw new Error('second beforeEach fails')
          })
          test('fails', () => {})
        })

        describe('skip', () => {
          beforeEach(({ skip }) => skip())
          beforeEach(({ skip }) => skip())
          test('skipped', () => {})
        })
      `,
    },
    { sequence: { hooks: 'parallel' } },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "beforeAll": {
          "__suite_errors__": [
            "first beforeAll fails",
            "second beforeAll fails",
          ],
          "skipped": "skipped",
        },
        "beforeEach": {
          "fails": [
            "first beforeEach fails",
            "second beforeEach fails",
          ],
        },
        "skip": {
          "skipped": "skipped",
        },
      },
    }
  `)
})

test('reports the abort reason once if parallel hooks reject with it', async () => {
  const { errorTree } = await runInlineTests(
    {
      'basic.test.js': `
        import { beforeEach, test } from 'vitest'

        beforeEach(() => new Promise((resolve) => setTimeout(resolve, 1000)), 100)
        beforeEach(async ({ signal }) => {
          await new Promise((resolve) => signal.addEventListener('abort', resolve))
          signal.throwIfAborted()
        })
        test('fails', () => {})
      `,
    },
    { sequence: { hooks: 'parallel' } },
  )

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "fails": [
          "Hook timed out in 100ms.
    If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".",
        ],
      },
    }
  `)
})

test('runs cleanups in sequence.hooks order if a later hook fails', async () => {
  const logs: Record<string, string> = {}
  for (const hooks of ['stack', 'list'] as const) {
    const { stdout } = await runInlineTests(
      {
        'basic.test.js': `
          import { afterAll, afterEach, beforeAll, beforeEach, describe, test } from 'vitest'

          beforeEach(() => () => console.log('>> root beforeEach cleanup'))

          describe('beforeAll', () => {
            beforeAll(() => () => console.log('>> first beforeAll cleanup'))
            beforeAll(() => () => console.log('>> second beforeAll cleanup'))
            beforeAll(() => {
              throw new Error('beforeAll fails')
            })
            afterAll(() => console.log('>> afterAll'))
            test('skipped', () => {})
          })

          describe('beforeEach', () => {
            beforeEach(() => () => console.log('>> first beforeEach cleanup'))
            beforeEach(() => () => console.log('>> second beforeEach cleanup'))
            beforeEach(() => {
              throw new Error('beforeEach fails')
            })
            afterEach(() => console.log('>> afterEach'))
            test('fails', () => {})
          })
        `,
      },
      { sequence: { hooks } },
    )
    logs[hooks] = extractLogs(stdout)
  }

  expect(logs).toMatchInlineSnapshot(`
    {
      "list": ">> afterAll
    >> first beforeAll cleanup
    >> second beforeAll cleanup
    >> afterEach
    >> root beforeEach cleanup
    >> first beforeEach cleanup
    >> second beforeEach cleanup",
      "stack": ">> afterAll
    >> second beforeAll cleanup
    >> first beforeAll cleanup
    >> afterEach
    >> second beforeEach cleanup
    >> first beforeEach cleanup
    >> root beforeEach cleanup",
    }
  `)
})

test('runs beforeEach cleanups of parent suites on every retry', async () => {
  const { stdout, stderr, errorTree } = await runInlineTests({
    'basic.test.js': `
      import { afterEach, beforeEach, describe, test } from 'vitest'

      beforeEach(() => () => console.log('>> root cleanup'))

      describe('nested', () => {
        let attempt = 0
        beforeEach(() => () => console.log('>> nested cleanup'))
        beforeEach(() => {
          if (attempt++ === 0) {
            throw new Error('beforeEach fails')
          }
        })
        afterEach(() => console.log('>> afterEach'))
        test('retried', { retry: 1 }, () => console.log('>> test'))
      })
    `,
  })

  expect(stderr).toBe('')
  expect(extractLogs(stdout)).toMatchInlineSnapshot(`
    ">> afterEach
    >> nested cleanup
    >> root cleanup
    >> test
    >> afterEach
    >> nested cleanup
    >> root cleanup"
  `)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "nested": {
          "retried": "passed",
        },
      },
    }
  `)
})

test('reports an error thrown by the cleanup together with the hook error', async () => {
  const { errorTree } = await runInlineTests({
    'basic.test.js': `
      import { beforeAll, beforeEach, describe, test } from 'vitest'

      describe('beforeAll', () => {
        beforeAll(() => () => {
          throw new Error('beforeAll cleanup fails')
        })
        beforeAll(() => {
          throw new Error('beforeAll fails')
        })
        test('skipped', () => {})
      })

      describe('beforeEach', () => {
        beforeEach(() => () => {
          throw new Error('beforeEach cleanup fails')
        })
        beforeEach(() => {
          throw new Error('beforeEach fails')
        })
        test('fails', () => {})
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "beforeAll": {
          "__suite_errors__": [
            "beforeAll fails",
            "beforeAll cleanup fails",
          ],
          "skipped": "skipped",
        },
        "beforeEach": {
          "fails": [
            "beforeEach fails",
            "beforeEach cleanup fails",
          ],
        },
      },
    }
  `)
})
