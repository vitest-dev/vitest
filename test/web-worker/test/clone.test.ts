import { version } from 'node:process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import MyWorker from '../src/objectWorker?worker'

const major = Number(version.split('.')[0].slice(1))

describe.runIf(major >= 17)('when node supports structuredClone', () => {
  it('uses native structure clone', () => {
    expect.assertions(4)

    expect(structuredClone).toBeDefined()

    const worker = new MyWorker()
    const buffer = new ArrayBuffer(1)
    const obj = { hello: 'world', buffer }
    worker.postMessage(obj, [buffer])

    return new Promise<void>((resolve, reject) => {
      worker.onmessage = (e) => {
        try {
          expect(e).toBeInstanceOf(MessageEvent)
          expect(e.data, 'doesn\'t keep reference').not.toBe(obj)
          expect(e.data, 'shape is equal').toEqual(obj)
          resolve()
        }
        catch (err) {
          reject(err)
        }
        finally {
          worker.terminate()
        }
      }
    })
  })

  it('throws error, if passing down unserializable data', () => {
    expect.assertions(4)

    expect(structuredClone).toBeDefined()

    const worker = new MyWorker()
    const obj = { hello: 'world', name() {} }
    worker.postMessage(obj)

    return new Promise<void>((resolve, reject) => {
      worker.onmessageerror = (e) => {
        try {
          expect(e.type).toBe('messageerror')
          expect(e).toBeInstanceOf(MessageEvent)
          expect(e.data.message).toContain(
            'could not be cloned.',
          )
          resolve()
        }
        catch (err) {
          reject(err)
        }
      }
    })
  })
})

describe('when passing down custom clone', () => {
  const { warn } = console

  beforeEach(() => {
    console.warn = warn
    process.env.VITEST_WEB_WORKER_CLONE = undefined
  })

  it('uses ponyfill clone', () => {
    expect.assertions(4)

    console.warn = vi.fn()
    process.env.VITEST_WEB_WORKER_CLONE = 'ponyfill'

    const worker = new MyWorker()
    const buffer = new ArrayBuffer(1)
    const obj = { hello: 'world' }
    worker.postMessage(obj, [buffer])

    return new Promise<void>((resolve, reject) => {
      worker.onmessageerror = (e) => {
        reject(e.data)
      }
      worker.onmessage = (e) => {
        try {
          expect(e).toBeInstanceOf(MessageEvent)
          expect(e.data, 'doesn\'t keep reference').not.toBe(obj)
          expect(e.data, 'shape is not equal, don\'t transfer buffer').toEqual({ hello: 'world' })
          expect(console.warn).toBeCalledWith(expect.stringContaining('[@vitest/web-worker] `structuredClone` is not supported in this'))
          resolve()
        }
        catch (err) {
          reject(err)
        }
        finally {
          worker.terminate()
        }
      }
    })
  })

  it('doesn\'t clone, if asked to', () => {
    expect.assertions(3)

    console.warn = vi.fn()
    process.env.VITEST_WEB_WORKER_CLONE = 'none'

    const worker = new MyWorker()
    const buffer = new ArrayBuffer(1)
    const obj = { hello: 'world', buffer }
    worker.postMessage(obj, [buffer])

    return new Promise<void>((resolve, reject) => {
      worker.onmessageerror = (e) => {
        reject(e.data)
      }
      worker.onmessage = (e) => {
        try {
          expect(e).toBeInstanceOf(MessageEvent)
          expect(e.data, 'keeps reference').toBe(obj)
          expect(console.warn).not.toHaveBeenCalled()
          resolve()
        }
        catch (err) {
          reject(err)
        }
        finally {
          worker.terminate()
        }
      }
    })
  })
})
