import http from 'node:http'
import { runInlineTests } from '#test-utils'
import { describe, expect, test } from 'vitest'

describe('ECONNRESET errors are filtered by default', () => {
  test('ECONNRESET error code is ignored', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'econnreset.test.js': `
        import { test } from "vitest"

        test("Some test", () => {
          const error = new Error("socket hang up")
          error.code = 'ECONNRESET'
          Promise.reject(error)
        })
      `,
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toMatch('ECONNRESET')
    expect(stderr).not.toMatch('socket hang up')
    expect(stderr).not.toMatch('Unhandled')
  })

  test('socket hang up message is ignored', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'socket-hangup.test.js': `
        import { test } from "vitest"

        test("Some test", () => {
          const error = new Error("socket hang up")
          Promise.reject(error)
        })
      `,
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toMatch('socket hang up')
    expect(stderr).not.toMatch('Unhandled')
  })

  test('other unhandled errors are still reported', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'other-error.test.js': `
        import { test } from "vitest"

        test("Some test", () => {
          Promise.reject(new Error("intentional error"))
        })
      `,
    })

    expect(exitCode).toBe(1)
    expect(stderr).toMatch('Unhandled')
    expect(stderr).toMatch('intentional error')
  })

  test('ECONNRESET errors can still be caught by onUnhandledError', async () => {
    const { stderr, exitCode } = await runInlineTests({
      'econnreset-custom.test.js': `
        import { test } from "vitest"

        test("Some test", () => {
          const error = new Error("socket hang up")
          error.code = 'ECONNRESET'
          Promise.reject(error)
        })
      `,
    }, {
      onUnhandledError(err) {
        if ('code' in err && err.code === 'ECONNRESET') {
          return false
        }
      },
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toMatch('ECONNRESET')
  })

  test('real HTTP connection error scenario', async () => {
    const server = http.createServer((req, _res) => {
      req.socket.destroy()
    })

    const port = await new Promise<number>((resolve) => {
      server.listen(0, () => {
        resolve((server.address() as any).port)
      })
    })

    const { stderr, exitCode } = await runInlineTests({
      'http-error.test.js': `
        import { test } from "vitest"
        import http from "node:http"

        test("HTTP connection test", async () => {
          const req = http.get('http://localhost:${port}', () => {
          })

          req.on('error', (err) => {
            Promise.reject(err)
          })

          await new Promise(resolve => setTimeout(resolve, 100))
        })
      `,
    })

    await new Promise<void>((resolve) => {
      server.close(() => resolve())
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toMatch('ECONNRESET')
    expect(stderr).not.toMatch('socket hang up')
  })
})
