import { afterEach } from 'vitest'
import { type Options, execa } from 'execa'
import stripAnsi from 'strip-ansi'

export async function startWatchMode(options?: Options | string, ...args: string[]) {
  if (typeof options === 'string')
    args.unshift(options)
  const argsWithRoot = args.includes('--root') ? args : ['--root', 'fixtures', ...args]
  const subprocess = execa('vitest', argsWithRoot, typeof options === 'string' ? undefined : options)

  let setDone: (value?: unknown) => void
  const isDone = new Promise(resolve => (setDone = resolve))

  const vitest = {
    output: '',
    listeners: [] as (() => void)[],
    isDone,
    write(text: string) {
      this.resetOutput()
      subprocess.stdin!.write(text)
    },
    waitForOutput(expected: string) {
      return new Promise<void>((resolve, reject) => {
        if (this.output.includes(expected))
          return resolve()

        const timeout = setTimeout(() => {
          reject(new Error(`Timeout when waiting for output "${expected}".\nReceived:\n${this.output}`))
        }, process.env.CI ? 20_000 : 4_000)

        const listener = () => {
          if (this.output.includes(expected)) {
            if (timeout)
              clearTimeout(timeout)

            resolve()
          }
        }

        this.listeners.push(listener)
      })
    },
    resetOutput() {
      this.output = ''
    },
  }

  subprocess.stdout!.on('data', (data) => {
    vitest.output += stripAnsi(data.toString())
    vitest.listeners.forEach(fn => fn())
  })

  subprocess.on('exit', () => setDone())

  // Manually stop the processes so that each test don't have to do this themselves
  afterEach(async () => {
    if (subprocess.exitCode === null)
      subprocess.kill()

    await vitest.isDone
  })

  // Wait for initial test run to complete
  await vitest.waitForOutput('Waiting for file changes')
  vitest.resetOutput()

  return vitest
}
