import type { TestSpecificationOptions } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test.each(
  [
    { testNamePattern: /two/ },
    { testLines: [8] },
    { testIds: ['-109630875_1'] },
  ] satisfies TestSpecificationOptions[],
)('runs with options %o', async (options) => {
  const { fs, ctx, errorTree } = await runInlineTests({
    'basic.test.js': /* js */ `
      import { test, expect } from 'vitest'

      test('one', () => {
        expect(1).toBe(1)
      })

      test('two', () => {
        expect(2).toBe(2)
      })
    `,
  }, { standalone: true, watch: true, includeTaskLocation: true })
  const vitest = ctx!

  // nothing run yet
  expect(vitest.state.idMap).toHaveLength(0)

  const specification = vitest.getRootProject().createSpecification(
    fs.resolveFile('./basic.test.js'),
    options,
  )

  await vitest.runTestSpecifications([specification])

  expect(errorTree()).toEqual({
    'basic.test.js': {
      one: 'skipped',
      two: 'passed',
    },
  })
})
