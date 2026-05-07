import type { TestModule } from 'vitest/node'
import { expect, it, onTestFinished, vi } from 'vitest'
import { createVitest } from 'vitest/node'

it(createVitest, async () => {
  const onTestRunEnd = vi.fn()
  const ctx = await createVitest('test', {
    watch: false,
    root: 'fixtures/create-vitest',
    reporters: [
      {
        onTestRunEnd,
      },
    ],
  })
  onTestFinished(() => ctx.close())
  const testFiles = await ctx.globTestSpecifications()
  await ctx.runTestSpecifications(testFiles, false)

  const [testModules, errors, reason] = onTestRunEnd.mock.calls[0]
  expect(testModules).toHaveLength(1)

  const testModule = testModules[0]
  expect((testModule as TestModule).task?.name).toBe('basic.test.ts')
  expect((testModule as TestModule).state()).toBe('passed')

  expect(errors).toHaveLength(0)
  expect(reason).toBe('passed')
})
