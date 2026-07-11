import { runInlineTests } from '#test-utils'
import { expect, test } from 'vitest'

test('mock type does not leak between non-isolated test files', async () => {
  const result = await runInlineTests(
    {
      'a.test.ts': `
        import { expect, test, vi } from 'vitest'
        import * as repo from './repo'

        vi.mock('./repo', () => ({ value: 'manual' }))

        test('uses the manual mock', () => {
          expect(repo.value).toBe('manual')
        })
      `,
      'b.test.ts': `
        import { expect, test, vi } from 'vitest'
        import * as repo from './repo'

        vi.mock('./repo')

        test('uses an automock', () => {
          expect(vi.isMockFunction(repo.value)).toBe(true)
          expect(repo.value()).toBeUndefined()
        })
      `,
      'repo.ts': `
        export function value() {
          return 'actual'
        }
      `,
    },
    {
      isolate: false,
      maxWorkers: 1,
      sequence: { shuffle: false },
    },
  )

  expect(result.errorTree()).toMatchInlineSnapshot(`
    {
      "a.test.ts": {
        "uses the manual mock": "passed",
      },
      "b.test.ts": {
        "uses an automock": "passed",
      },
    }
  `)
})
