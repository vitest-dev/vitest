// @vitest-environment node

import { version } from 'node:process'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import MyEventListenerWorker from '../src/web-worker/eventListenerWorker?worker'

import MyObjectWorker from '../src/web-worker/objectWorker?worker'
import MySelfWorker from '../src/web-worker/selfWorker?worker'
import MySharedWorker from '../src/web-worker/sharedWorker?sharedworker'
import GlobalsWorker from '../src/web-worker/worker-globals?worker'
import MyWorker from '../src/web-worker/worker?worker'
import '@vitest/web-worker'

const major = Number(version.split('.')[0].slice(1))

describe.runIf(major >= 17)('when node supports structuredClone', () => {
  it('uses native structure clone', () => {
    expect.assertions(4)

    expect(structuredClone).toBeDefined()

    const worker = new MyObjectWorker()
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

    const worker = new MyObjectWorker()
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

    const worker = new MyObjectWorker()
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

    const worker = new MyObjectWorker()
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

function sleep(time: number) {
  return new Promise(resolve => setTimeout(resolve, time))
}

function testWorker(worker: Worker) {
  return new Promise<void>((resolve) => {
    worker.postMessage('hello')
    worker.onmessage = (e) => {
      expect(e.data).toBe('hello world')

      resolve()
    }
  })
}

function testSelfWorker(worker: Worker) {
  return new Promise<boolean>((resolve) => {
    worker.onmessage = (e) => {
      resolve(e.data)
    }
  })
}

it('worker exists', async () => {
  expect(Worker).toBeDefined()
})

it('simple worker', async () => {
  expect.assertions(1)

  await testWorker(new MyWorker())
})

it('event listener worker', async () => {
  expect.assertions(1)

  await testWorker(new MyEventListenerWorker())
})

it('can test workers several times', async () => {
  expect.assertions(1)

  await testWorker(new MyWorker())
})

it('worker with url', async () => {
  expect.assertions(1)
  const url = import.meta.url

  await testWorker(new Worker(new URL('../src/web-worker/worker.ts', url)))
})

it('self injected into worker and its deps should be equal', async () => {
  expect.assertions(4)
  expect(await testSelfWorker(new MySelfWorker())).toBeTruthy()
  // wait for clear worker mod cache
  await sleep(0)
  expect(await testSelfWorker(new MySelfWorker())).toBeTruthy()

  await sleep(0)

  expect(await testSelfWorker(new Worker(new URL('../src/web-worker/selfWorker.ts', import.meta.url)))).toBeTruthy()
  // wait for clear worker mod cache
  await sleep(0)
  expect(await testSelfWorker(new Worker(new URL('../src/web-worker/selfWorker.ts', import.meta.url)))).toBeTruthy()
})

it('throws syntax error if no arguments are provided', () => {
  const worker = new MyWorker()

  // @ts-expect-error requires at least one argument
  expect(() => worker.postMessage()).toThrowError(SyntaxError)
  expect(() => worker.postMessage(undefined)).not.toThrowError()
  expect(() => worker.postMessage(null)).not.toThrowError()
})

function sendEventMessage(worker: SharedWorker, msg: any) {
  worker.port.postMessage(msg)
  return new Promise<string>((resolve) => {
    worker.port.addEventListener('message', function onmessage(e) {
      worker.port.removeEventListener('message', onmessage)
      resolve(e.data as string)
    })
  })
}

function sendOnMessage(worker: SharedWorker, msg: any) {
  worker.port.postMessage(msg)
  return new Promise<string>((resolve) => {
    worker.port.onmessage = function onmessage(e) {
      worker.port.onmessage = null
      resolve(e.data as string)
    }
  })
}

it('vite shared worker works', async () => {
  expect(MySharedWorker).toBeDefined()
  expect(SharedWorker).toBeDefined()
  const worker = new MySharedWorker()
  expect(worker).toBeInstanceOf(SharedWorker)

  await expect(sendEventMessage(worker, 'event')).resolves.toBe('event')
  await expect(sendOnMessage(worker, 'event')).resolves.toBe('event')
})

it('shared worker with path works', async () => {
  expect(SharedWorker).toBeDefined()
  const worker = new SharedWorker(new URL('../src/web-worker/sharedWorker.ts', import.meta.url))
  expect(worker).toBeTruthy()

  await expect(sendEventMessage(worker, 'event')).resolves.toBe('event')
  await expect(sendOnMessage(worker, 'event')).resolves.toBe('event')
})

it('doesn\'t trigger events, if closed', async () => {
  const worker = new MySharedWorker()
  worker.port.close()
  await new Promise((resolve) => {
    worker.port.addEventListener('message', () => {
      expect.unreachable('should not trigger message')
    })
    worker.port.postMessage('event')
    setTimeout(resolve, 100)
  })
})

it('returns globals on self correctly', async () => {
  const worker = new GlobalsWorker()
  await new Promise<void>((resolve, reject) => {
    worker.onmessage = (e) => {
      try {
        expect(e.data).toEqual({
          crypto: !!globalThis.crypto,
          location: !!globalThis.location,
          caches: !!globalThis.caches,
          origin: 'http://localhost:3000',
        })
        resolve()
      }
      catch (err) {
        reject(err)
      }
    }
    worker.onerror = reject
    worker.postMessage(null)
  })
})
