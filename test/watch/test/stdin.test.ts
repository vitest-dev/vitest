import { test } from 'vitest'

import { startWatchMode } from './utils'

test('quit watch mode', async () => {
  const vitest = await startWatchMode()

  vitest.write('q')

  await vitest.isDone
})

test('filter by filename', async () => {
  const vitest = await startWatchMode()

  vitest.write('p')

  await vitest.waitForOutput('Input filename pattern')

  vitest.write('math\n')

  await vitest.waitForOutput('Filename pattern: math')
  await vitest.waitForOutput('1 passed')
})

test('filter by test name', async () => {
  const vitest = await startWatchMode()

  vitest.write('t')

  await vitest.waitForOutput('Input test name pattern')

  vitest.write('sum\n')

  await vitest.waitForOutput('Test name pattern: /sum/')
  await vitest.waitForOutput('1 passed')
})
