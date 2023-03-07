import { expect, test } from 'vitest'

import { startWatchMode, waitFor } from './utils'

test('quit watch mode', async () => {
  const vitest = await startWatchMode()

  vitest.write('q')

  await vitest.isDone
})

test('filter by filename', async () => {
  const vitest = await startWatchMode()

  vitest.write('p')

  await waitFor(() => {
    expect(vitest.getOutput()).toMatch('Input filename pattern')
  })

  vitest.write('math\n')

  await waitFor(() => {
    expect(vitest.getOutput()).toMatch('Filename pattern: math')
    expect(vitest.getOutput()).toMatch('1 passed')
  })
})

test('filter by test name', async () => {
  const vitest = await startWatchMode()

  vitest.write('t')

  await waitFor(() => {
    expect(vitest.getOutput()).toMatch('Input test name pattern')
  })

  vitest.write('sum\n')

  await waitFor(() => {
    expect(vitest.getOutput()).toMatch('Test name pattern: /sum/')
    expect(vitest.getOutput()).toMatch('1 passed')
  })
})
