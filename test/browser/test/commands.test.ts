import { expect, it } from 'vitest'
import { server } from 'vitest/browser'

const { readFile, writeFile, removeFile, myCustomCommand } = server.commands

it('can manipulate files', async () => {
  const file = './test.txt'

  // diagnostic: webkit on macOS occasionally lets readFile return instead of
  // throwing ENOENT; the logs help us see exactly what the call resolved to
  // when it did not throw, and how the error looks when it did.
  // eslint-disable-next-line no-console
  const log = (msg: string) => console.log(`[flake-dbg] commands.test ${msg}`)

  try {
    const result = await readFile(file)
    log(`readFile(missing #1) resolved with type=${typeof result} value=${JSON.stringify(result).slice(0, 200)} platform=${server.platform}`)
    expect.unreachable()
  }
  catch (err) {
    log(`readFile(missing #1) threw name=${(err as any)?.constructor?.name} message=${JSON.stringify((err as any)?.message ?? '')}`)
    expect(err.message).toMatch(`ENOENT: no such file or directory, open`)
    if (server.platform === 'win32') {
      expect(err.message).toMatch('test\\browser\\test.txt')
    }
    else {
      expect(err.message).toMatch('test/browser/test.txt')
    }
  }

  await writeFile(file, 'hello world')
  const content = await readFile(file)

  expect(content).toBe('hello world')

  await removeFile(file)

  try {
    const result = await readFile(file)
    log(`readFile(missing #2) resolved with type=${typeof result} value=${JSON.stringify(result).slice(0, 200)} platform=${server.platform}`)
    expect.unreachable()
  }
  catch (err) {
    log(`readFile(missing #2) threw name=${(err as any)?.constructor?.name} message=${JSON.stringify((err as any)?.message ?? '')}`)
    expect(err.message).toMatch(`ENOENT: no such file or directory, open`)
    if (server.platform === 'win32') {
      expect(err.message).toMatch('test\\browser\\test.txt')
    }
    else {
      expect(err.message).toMatch('test/browser/test.txt')
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
