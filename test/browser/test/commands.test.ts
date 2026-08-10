import { expect, it } from 'vitest'
import { server } from 'vitest/browser'

const { readFile, writeFile, removeFile, myCustomCommand } = server.commands

it('can manipulate files', async () => {
  // all browser instances run this file against the same cwd in parallel,
  // so the file name must be unique per instance to avoid races
  const file = `./test-${server.browser}.txt`

  try {
    await readFile(file)
    expect.unreachable()
  }
  catch (err) {
    expect(err.message).toMatch(`ENOENT: no such file or directory, open`)
    if (server.platform === 'win32') {
      expect(err.message).toMatch(`test\\browser\\test-${server.browser}.txt`)
    }
    else {
      expect(err.message).toMatch(`test/browser/test-${server.browser}.txt`)
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
      expect(err.message).toMatch(`test\\browser\\test-${server.browser}.txt`)
    }
    else {
      expect(err.message).toMatch(`test/browser/test-${server.browser}.txt`)
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

declare module 'vitest/browser' {
  interface BrowserCommands {
    myCustomCommand: (arg1: string, arg2: string) => Promise<{
      testPath: string
      arg1: string
      arg2: string
    }>

    stripVTControlCharacters: (text: string) => Promise<string>
    startTrace: () => Promise<void>
    stopTrace: () => Promise<void>
  }
}
