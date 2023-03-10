import { expect, test } from 'vitest'

import { runVitest } from './utils'

test('shard cannot be used with watch mode', async () => {
  const { error } = await runVitest('watch', ['--shard', '1/2'])

  expect(error).toMatch('Error: You cannot use --shard option with enabled watch')
})

test('shard must be positive number', async () => {
  const { error } = await runVitest('run', ['--shard', '"-1"'])

  expect(error).toMatch('Error: --shard <count> must be a positive number')
})

test('shard index must be smaller than count', async () => {
  const { error } = await runVitest('run', ['--shard', '2/1'])

  expect(error).toMatch('Error: --shard <index> must be a positive number less then <count>')
})
