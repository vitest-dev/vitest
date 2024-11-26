import { expect, it, vi } from 'vitest'
import { createVitest } from 'vitest/node'

it(createVitest, async () => {
  const onFinished = vi.fn()
  const ctx = await createVitest('test', {
    watch: false,
    root: 'fixtures/create-vitest',
    reporters: [
      {
        onFinished,
      },
    ],
  })
  const testFiles = await ctx.globTestSpecifications()
  await ctx.runTestSpecifications(testFiles, false)
  expect(onFinished.mock.calls[0]).toMatchObject([
    [
      {
        name: 'basic.test.ts',
        result: {
          state: 'pass',
        },
      },
    ],
    [],
    undefined,
  ])
})
