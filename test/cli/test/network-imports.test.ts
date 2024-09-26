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

const [major] = process.version.slice(1).split('.')

// --experimental-network-imports was removed in Node 22 in favor of module loaders
it.runIf(Number(major) <= 20).each([
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
