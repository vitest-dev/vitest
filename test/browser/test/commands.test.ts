import { server } from '@vitest/browser/context'
import { expect, it } from 'vitest'

const { readFile, writeFile, removeFile, myCustomCommand } = server.commands

it('can manipulate files', async () => {
  const file = './test.txt'

  try {
    await readFile(file)
    expect.unreachable()
  }
  catch (err) {
    expect(err.message).toMatch(`ENOENT: no such file or directory, open`)
    if (server.platform === 'win32') {
      expect(err.message).toMatch('test\\browser\\test\\test.txt')
    }
    else {
      expect(err.message).toMatch('test/browser/test/test.txt')
    }
  }

  await writeFile(file, 'hello world')
  const content = await readFile(file)

  expect(content).toBe('hello world')

  await removeFile(file)

  try {
    await readFile(file)
    expect.unreachable()
  }
  catch (err) {
    expect(err.message).toMatch(`ENOENT: no such file or directory, open`)
    if (server.platform === 'win32') {
      expect(err.message).toMatch('test\\browser\\test\\test.txt')
    }
    else {
      expect(err.message).toMatch('test/browser/test/test.txt')
    }
  }
})

it('can run custom commands', async () => {
  const result = await myCustomCommand('arg1', 'arg2')
  expect(result).toEqual({
    testPath: expect.stringMatching('test/browser/test/commands.test.ts'),
    arg1: 'arg1',
    arg2: 'arg2',
  })
})

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    myCustomCommand: (arg1: string, arg2: string) => Promise<{
      testPath: string
      arg1: string
      arg2: string
    }>

    stripVTControlCharacters: (text: string) => Promise<string>
  }
}
