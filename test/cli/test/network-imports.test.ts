import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

const config = {
  poolOptions: {
    threads: {
      execArgv: ['--experimental-network-imports'],
    },
    forks: {
      execArgv: ['--experimental-network-imports'],
    },
    vmThreads: {
      execArgv: ['--experimental-network-imports'],
    },
  },
  // let vite serve public/slash@3.0.0.js
  api: 9602,
}

it.each([
  'threads',
  'forks',
  'vmThreads',
])('importing from network in %s', async (pool) => {
  const { stderr, exitCode } = await runVitest({
    ...config,
    root: './fixtures/network-imports',
    pool,
  })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
