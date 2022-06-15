import { expect, test } from 'vitest'
import { basename } from 'pathe'
import { execa } from 'execa'

const runVitest = async (args: string[]) => {
  const { stdout } = await execa('vitest', ['--run', '--dir', './test', ...args])
  return stdout
}

const parsePaths = (stdout: string) => {
  return stdout
    .split('\n')
    .filter(line => line && line.includes('.test.js'))
    .map(file => basename(file.trim().split(' ')[1]))
    .sort()
}

test('--shard=1/1', async () => {
  const stdout = await runVitest(['--shard=1/1'])

  const paths = parsePaths(stdout)

  expect(paths).toEqual(['1.test.js', '2.test.js', '3.test.js'])
})

test('--shard=1/2', async () => {
  const stdout = await runVitest(['--shard=1/2'])

  const paths = parsePaths(stdout)

  expect(paths).toEqual(['1.test.js', '2.test.js'])
})

test('--shard=2/2', async () => {
  const stdout = await runVitest(['--shard=2/2'])

  const paths = parsePaths(stdout)

  expect(paths).toEqual(['3.test.js'])
})

test('--shard=4/4', async () => {
  const stdout = await runVitest(['--shard=4/4'])

  const paths = parsePaths(stdout)

  // project only has 3 files
  // shards > 3 are empty
  expect(paths).toEqual([])
})
