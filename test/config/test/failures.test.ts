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

test('inspect requires changing threads or singleThread', async () => {
  const { error } = await runVitest('run', ['--inspect'])

  expect(error).toMatch('Error: You cannot use --inspect without "threads: false" or "singleThread: true"')
})

test('inspect cannot be used with threads', async () => {
  const { error } = await runVitest('run', ['--inspect', '--threads', 'true'])

  expect(error).toMatch('Error: You cannot use --inspect without "threads: false" or "singleThread: true"')
})

test('inspect-brk cannot be used with threads', async () => {
  const { error } = await runVitest('run', ['--inspect-brk', '--threads', 'true'])

  expect(error).toMatch('Error: You cannot use --inspect-brk without "threads: false" or "singleThread: true"')
})
