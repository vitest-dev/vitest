import { expect, test } from 'vitest'
import { getWorkerState } from '../../../packages/vitest/src/utils'

test('--exclude', async () => {
  await runCli('--exclude', 'index.spec.ts')

  // is this the 'correct' way to get the vitest instance?
  const worker = getWorkerState()

  expect(worker.config.exclude).toContain('index.spec.ts')
})

async function runCli(...args: string[]) {
  // we don't care about the first 2 value here
  process.argv = [
    '',
    '',
    ...args,
  ]

  return import('../../../packages/vitest/src/node/cli')
}
