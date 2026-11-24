import { expect, it } from 'vitest'
import { runInlineTests, StableTestFileOrderSorter } from '../../test-utils'

it('restoreAllMocks failure in isolate: false does not poison worker or prevent subsequent files from running', async () => {
  const { results, errorTree } = await runInlineTests(
    {
      'a.test.js': `
        import { expect, it, vi } from 'vitest'
        const target = { read: () => 'real' }
        it('spies on a method, freezes its object, and cleanup throws', () => {
          vi.spyOn(target, 'read')
          Object.freeze(target)
          expect(target.read()).toBe('real')
          // Testing cleanup failure during file execution
          expect(() => vi.restoreAllMocks()).toThrowError(/Cannot redefine property/)
        })
      `,
      'b.test.js': `
        import { expect, it } from 'vitest'
        it('runs b', () => {
          expect(1).toBe(1)
        })
      `,
      'c.test.js': `
        import { expect, it } from 'vitest'
        it('runs c', () => {
          expect(1).toBe(1)
        })
      `,
    },
    {
      isolate: false,
      fileParallelism: false,
      sequence: { sequencer: StableTestFileOrderSorter },
    },
  )

  // Verify all 3 test files were executed and passed
  expect(results).toHaveLength(3)
  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "a.test.js": {
        "spies on a method, freezes its object, and cleanup throws": "passed",
      },
      "b.test.js": {
        "runs b": "passed",
      },
      "c.test.js": {
        "runs c": "passed",
      },
    }
  `)
})
