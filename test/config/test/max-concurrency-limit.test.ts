import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

async function runAndVerify(limit: number, fixturePath: string) {
  const { exitCode, stderr } = await runVitest(
    {
      root: './fixtures/max-concurrency-limit',
      include: [fixturePath],
      maxConcurrency: limit,
    },
    [],
    'test',
    {
      define: { __CONCURRENCY_LIMIT__: limit },
    },
  )
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
}

test('should limit concurrency for only test.concurrent', async () => {
  await runAndVerify(2, `max-concurrency-limit.test.ts`)
})

test('should limit concurrency for hooks and test', async () => {
  await runAndVerify(2, `max-concurrency-limit-with-hooks.test.ts`)
})
