import { afterEach, expect } from 'vitest'
import { execa } from 'execa'
import stripAnsi from 'strip-ansi'

export async function startWatchMode() {
  const subprocess = execa('vitest', ['--root', 'fixtures'])

  let setDone: (value?: unknown) => void
  const isDone = new Promise(resolve => (setDone = resolve))

  const vitest = {
    output: '',
    isDone,
    write(text: string) {
      this.resetOutput()
      subprocess.stdin!.write(text)
    },
    getOutput() {
      return this.output
    },
    resetOutput() {
      this.output = ''
    },
  }

  subprocess.stdout!.on('data', (data) => {
    vitest.output += stripAnsi(data.toString())
  })

  subprocess.on('exit', () => setDone())

  // Manually stop the processes so that each test don't have to do this themselves
  afterEach(async () => {
    if (subprocess.exitCode === null)
      subprocess.kill()

    await vitest.isDone
  })

  // Wait for initial test run to complete
  await waitFor(() => {
    expect(vitest.getOutput()).toMatch('Waiting for file changes')
  })
  vitest.resetOutput()

  return vitest
}

export async function waitFor(method: () => unknown, retries = 100): Promise<void> {
  try {
    method()
  }
  catch (error) {
    if (retries === 0) {
      console.error(error)
      throw error
    }

    await new Promise(resolve => setTimeout(resolve, 250))
    return waitFor(method, retries - 1)
  }
}
