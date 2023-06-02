import { Console } from 'node:console'
import { Writable } from 'node:stream'
import { type UserConfig, type VitestRunMode, afterEach } from 'vitest'
import type { Vitest } from 'vitest/node'
import { startVitest } from 'vitest/node'
import { type Options, execa } from 'execa'
import stripAnsi from 'strip-ansi'

export async function runVitest(config: UserConfig, cliFilters: string[] = [], mode: VitestRunMode = 'test') {
  // Reset possible previous runs
  process.exitCode = 0

  // Prevent possible process.exit() calls, e.g. from --browser
  const exit = process.exit
  process.exit = (() => { }) as never

  const { getLogs, restore } = captureLogs()

  let vitest: Vitest | undefined
  try {
    vitest = await startVitest(mode, cliFilters, {
      watch: false,
      reporters: ['verbose'],
      ...config,
    })
  }
  catch (e: any) {
    return {
      stderr: `${getLogs().stderr}\n${e.message}`,
      stdout: getLogs().stdout,
      exitCode: process.exitCode,
      vitest,
    }
  }
  finally {
    restore()
  }

  const exitCode = process.exitCode
  process.exitCode = 0
  process.exit = exit

  return { ...getLogs(), exitCode, vitest }
}

function captureLogs() {
  const stdout: string[] = []
  const stderr: string[] = []

  const streams = {
    stdout: new Writable({
      write(chunk, _, callback) {
        stdout.push(chunk.toString())
        callback()
      },
    }),
    stderr: new Writable({
      write(chunk, _, callback) {
        stderr.push(chunk.toString())
        callback()
      },
    }),
  }

  const originalConsole = globalThis.console
  globalThis.console = new Console(streams)

  const originalStdoutWrite = process.stdout.write
  process.stdout.write = streams.stdout.write.bind(streams.stdout) as any

  const originalStderrWrite = process.stderr.write
  process.stderr.write = streams.stderr.write.bind(streams.stderr) as any

  return {
    restore: () => {
      globalThis.console = originalConsole
      process.stdout.write = originalStdoutWrite
      process.stderr.write = originalStderrWrite
    },
    getLogs() {
      return {
        stdout: stripAnsi(stdout.join('')),
        stderr: stripAnsi(stderr.join('')),
      }
    },
  }
}

export async function runVitestCli(_options?: Options | string, ...args: string[]) {
  let options = _options

  if (typeof _options === 'string') {
    args.unshift(_options)
    options = undefined
  }

  const subprocess = execa('vitest', args, options as Options)

  let setDone: (value?: unknown) => void
  const isDone = new Promise(resolve => (setDone = resolve))

  const vitest = {
    stdout: '',
    stderr: '',
    stdoutListeners: [] as (() => void)[],
    stderrListeners: [] as (() => void)[],
    isDone,
    write(text: string) {
      this.resetOutput()
      subprocess.stdin!.write(text)
    },
    waitForStdout(expected: string) {
      return new Promise<void>((resolve, reject) => {
        if (this.stdout.includes(expected))
          return resolve()

        const timeout = setTimeout(() => {
          reject(new Error(`Timeout when waiting for output "${expected}".\nReceived:\n${this.stdout}. \nStderr:\n${this.stderr}`))
        }, process.env.CI ? 20_000 : 4_000)

        const listener = () => {
          if (this.stdout.includes(expected)) {
            if (timeout)
              clearTimeout(timeout)

            resolve()
          }
        }

        this.stdoutListeners.push(listener)
      })
    },
    waitForStderr(expected: string) {
      return new Promise<void>((resolve, reject) => {
        if (this.stderr.includes(expected))
          return resolve()

        const timeout = setTimeout(() => {
          reject(new Error(`Timeout when waiting for error "${expected}".\nReceived:\n${this.stderr}`))
        }, process.env.CI ? 20_000 : 4_000)

        const listener = () => {
          if (this.stderr.includes(expected)) {
            if (timeout)
              clearTimeout(timeout)

            resolve()
          }
        }

        this.stderrListeners.push(listener)
      })
    },
    resetOutput() {
      this.stdout = ''
      this.stderr = ''
    },
  }

  subprocess.stdout!.on('data', (data) => {
    vitest.stdout += stripAnsi(data.toString())
    vitest.stdoutListeners.forEach(fn => fn())
  })

  subprocess.stderr!.on('data', (data) => {
    vitest.stderr += stripAnsi(data.toString())
    vitest.stderrListeners.forEach(fn => fn())
  })

  subprocess.on('exit', () => setDone())

  // Manually stop the processes so that each test don't have to do this themselves
  afterEach(async () => {
    if (subprocess.exitCode === null)
      subprocess.kill()

    await vitest.isDone
  })

  if (args.includes('--watch')) { // Wait for initial test run to complete
    await vitest.waitForStdout('Waiting for file changes')
    vitest.resetOutput()
  }
  else {
    await vitest.isDone
  }

  return vitest
}
