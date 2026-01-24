import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

const config = {
  execArgv: ['--experimental-network-imports'],
  // let vite serve public/slash@3.0.0.js
  api: 9602,
}

const [major] = process.version.slice(1).split('.')

// TODO: remove when we drop support for Node 20
// --experimental-network-imports was removed in Node 22 in favor of module loaders
it.runIf(Number(major) <= 20).each([
  'threads',
  'forks',
  'vmThreads',
])('importing from network in %s', async (pool) => {
  const { ctx, exitCode } = await runVitest({
    ...config,
    root: './fixtures/network-imports',
    pool,
  })
  expect(ctx!.state.getTestModules()).toHaveLength(1)
  expect(ctx!.state.getTestModules()[0].state()).toBe('passed')
  expect(exitCode).toBe(0)
})
