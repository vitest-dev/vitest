import { server } from '@vitest/browser/context'
import { describe, expect, test } from 'vitest'

const { removeFile, writeFile } = server.commands

describe('fs security', () => {
  test('fs writeFile throws an error', async () => {
    await writeFile('/test-file.txt', 'Hello World')
  })

  test('fs removeFile throws an error', async () => {
    await removeFile('/test-file.txt')
  })

  test('snapshot saves are not saved', () => {
    expect('snapshot content').toMatchSnapshot()
  })
})
