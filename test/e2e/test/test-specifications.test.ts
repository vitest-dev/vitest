import type { TestSpecificationOptions } from 'vitest/node'
import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test.for(
  [
    { testNamePattern: /two/ },
    { testLines: [8] },
    { testIds: ['-1838252165_1'] },
  ] satisfies TestSpecificationOptions[],
)('runs with options %o', async (options, { onTestFailed }) => {
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
  onTestFailed(() => {
    // eslint-disable-next-line no-console
    console.log('⚠️⚠️⚠️ Failed options', options)
    for (const [id, task] of vitest.state.idMap.entries()) {
      // eslint-disable-next-line no-console
      console.log({
        id,
        name: task.name,
        mode: task.mode,
        type: task.type,
        location: task.location,
      })
    }
  })

  expect(errorTree()).toEqual({
    'basic.test.js': {
      one: 'skipped',
      two: 'passed',
    },
  })
})
