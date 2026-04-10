import type { Readable, Writable } from 'node:stream'
import { stripVTControlCharacters } from 'node:util'

type Listener = (() => void)
type ReadableOrWritable = Readable | Writable
type Source = 'stdout' | 'stderr'

export class Cli {
  stdout = ''
  stderr = ''

  private stdoutListeners: Listener[] = []
  private stderrListeners: Listener[] = []
  private stdin: ReadableOrWritable
  private preserveAnsi?: boolean

  constructor(options: { stdin: ReadableOrWritable; stdout: ReadableOrWritable; stderr: ReadableOrWritable; preserveAnsi?: boolean }) {
    this.stdin = options.stdin
    this.stdin = options.stdin
    this.preserveAnsi = options.preserveAnsi

    for (const source of (['stdout', 'stderr'] as const)) {
      const stream = options[source]

      if ((stream as Readable).readable) {
        stream.on('data', (data) => {
          this.capture(source, data)
        })
      }
      else if (isWritable(stream)) {
        const original = stream.write.bind(stream)

        // @ts-expect-error -- Is there a better way to detect when a Writable is being written into?
        stream.write = (data, encoding, callback) => {
          this.capture(source, data)
          return original(data, encoding, callback)
        }
      }
    }
  }

  private capture(source: Source, data: any) {
    const msg = this.preserveAnsi ? data.toString() : stripVTControlCharacters(data.toString())
    this[source] += msg
    this[`${source}Listeners`].forEach(fn => fn())
  }

  write(data: string) {
    this.resetOutput()

    if (((this.stdin as Readable).readable)) {
      this.stdin.emit('data', data)
    }
    else if (isWritable(this.stdin)) {
      this.stdin.write(data)
    }
  }

  resetOutput() {
    this.stdout = ''
    this.stderr = ''
  }

  waitForStdout(expected: string, timeout?: number) {
    return this.waitForOutput(expected, 'stdout', this.waitForStdout, timeout)
  }

  waitForStderr(expected: string, timeout?: number) {
    return this.waitForOutput(expected, 'stderr', this.waitForStderr, timeout)
  }

  private waitForOutput(
    expected: string,
    source: Source,
    caller: Parameters<typeof Error.captureStackTrace>[1],
    timeout?: number,
  ) {
    const error = new Error('Timeout')
    Error.captureStackTrace(error, caller)

    return new Promise<void>((resolve, reject) => {
      if (this[source].includes(expected)) {
        return resolve()
      }

      const timeoutId = setTimeout(() => {
        error.message = `Timeout when waiting for error "${expected}".\nReceived:\nstdout: ${this.stdout}\nstderr: ${this.stderr}`
        reject(error)
      }, timeout ?? process.env.CI ? 20_000 : 4_000)

      const listener = () => {
        if (this[source].includes(expected)) {
          if (timeoutId) {
            clearTimeout(timeoutId)
          }

          resolve()
        }
      }

      this[`${source}Listeners`].push(listener)
    })
  }
}

function isWritable(stream: any): stream is Writable {
  return stream && typeof stream.write === 'function'
}
