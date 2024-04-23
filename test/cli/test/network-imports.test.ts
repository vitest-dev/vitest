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
    // not supported?
    //   FAIL  test/basic.test.ts [ test/basic.test.ts ]
    //   Error: ENOENT: no such file or directory, open 'http://localhost:9602/slash@3.0.0.js'
    //    ❯ Object.openSync node:fs:596:3
    //    ❯ readFileSync node:fs:464:35
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
  // 'vmThreads',
])('importing from network in %s', async (pool) => {
  const { stderr, exitCode } = await runVitest({
    ...config,
    root: './fixtures/network-imports',
    pool,
  })
  expect(stderr).toBe('')
  expect(exitCode).toBe(0)
})
