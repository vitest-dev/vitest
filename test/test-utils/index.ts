import { Console } from 'node:console'
import { Writable } from 'node:stream'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { type UserConfig, type VitestRunMode, afterEach } from 'vitest'
import type { Vitest } from 'vitest/node'
import { startVitest } from 'vitest/node'
import { type Options, execa } from 'execa'
import stripAnsi from 'strip-ansi'
import { dirname, resolve } from 'pathe'

export async function runVitest(config: UserConfig, cliFilters: string[] = [], mode: VitestRunMode = 'test') {
  // Reset possible previous runs
  process.exitCode = 0
  let exitCode = process.exitCode

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
      exitCode,
      vitest,
    }
  }
  finally {
    exitCode = process.exitCode
    process.exitCode = 0
    process.exit = exit

    restore()
  }

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

export async function runCli(command: string, _options?: Options | string, ...args: string[]) {
  let options = _options

  if (typeof _options === 'string') {
    args.unshift(_options)
    options = undefined
  }

  const subprocess = execa(command, args, options as Options)

  let setDone: (value?: unknown) => void
  const isDone = new Promise(resolve => (setDone = resolve))

  const cli = {
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
      const error = new Error('Timeout error')
      Error.captureStackTrace(error, this.waitForStdout)
      return new Promise<void>((resolve, reject) => {
        if (this.stdout.includes(expected))
          return resolve()

        const timeout = setTimeout(() => {
          error.message = `Timeout when waiting for output "${expected}".\nReceived:\n${this.stdout} \nStderr:\n${this.stderr}`
          reject(error)
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
      const error = new Error('Timeout')
      Error.captureStackTrace(error, this.waitForStderr)
      return new Promise<void>((resolve, reject) => {
        if (this.stderr.includes(expected))
          return resolve()

        const timeout = setTimeout(() => {
          error.message = `Timeout when waiting for error "${expected}".\nReceived:\n${this.stderr}\nStdout:\n${this.stdout}`
          reject(error)
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
    cli.stdout += stripAnsi(data.toString())
    cli.stdoutListeners.forEach(fn => fn())
  })

  subprocess.stderr!.on('data', (data) => {
    cli.stderr += stripAnsi(data.toString())
    cli.stderrListeners.forEach(fn => fn())
  })

  subprocess.on('exit', () => setDone())

  // Manually stop the processes so that each test don't have to do this themselves
  afterEach(async () => {
    if (subprocess.exitCode === null)
      subprocess.kill()

    await cli.isDone
  })

  if (args.includes('--watch')) {
    if (command === 'vitest') // Wait for initial test run to complete
      await cli.waitForStdout('Waiting for file changes')
    // make sure watcher is ready
    await cli.waitForStdout('[debug] watcher is ready')
    cli.stdout = cli.stdout.replace('[debug] watcher is ready\n', '')
  }
  else {
    await cli.isDone
  }

  return cli
}

export async function runVitestCli(_options?: Options | string, ...args: string[]) {
  process.env.VITE_TEST_WATCHER_DEBUG = 'true'
  return runCli('vitest', _options, ...args)
}

export async function runViteNodeCli(_options?: Options | string, ...args: string[]) {
  process.env.VITE_TEST_WATCHER_DEBUG = 'true'
  return runCli('vite-node', _options, ...args)
}

const originalFiles = new Map<string, string>()
const createdFiles = new Set<string>()
afterEach(() => {
  originalFiles.forEach((content, file) => {
    fs.writeFileSync(file, content, 'utf-8')
  })
  createdFiles.forEach((file) => {
    if (fs.existsSync(file))
      fs.unlinkSync(file)
  })
  originalFiles.clear()
  createdFiles.clear()
})

export function createFile(file: string, content: string) {
  createdFiles.add(file)
  fs.mkdirSync(dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf-8')
}

export function editFile(file: string, callback: (content: string) => string) {
  const content = fs.readFileSync(file, 'utf-8')
  if (!originalFiles.has(file))
    originalFiles.set(file, content)
  fs.writeFileSync(file, callback(content), 'utf-8')
}

export function resolvePath(baseUrl: string, path: string) {
  const filename = fileURLToPath(baseUrl)
  return resolve(dirname(filename), path)
}
