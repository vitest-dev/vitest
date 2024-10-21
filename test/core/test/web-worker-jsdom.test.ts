// @vitest-environment jsdom

import { expect, it } from 'vitest'

import GlobalsWorker from '../src/web-worker/worker-globals?worker'
import '@vitest/web-worker'

it('worker with invalid url throws an error', async () => {
  const url = import.meta.url
  const worker = new Worker(new URL('../src/web-worker/workerInvalid-path.ts', url))
  const event = await new Promise<ErrorEvent>((resolve) => {
    worker.onerror = (e) => {
      resolve(e)
    }
  })
  expect(event).toBeInstanceOf(ErrorEvent)
  // Error is in different context when running in VM. This is consistent with jest.
  if (!import.meta.env.VITEST_VM_POOL) {
    expect(event.error).toBeInstanceOf(Error)
  }
  expect(event.error.message).toContain('Failed to load')
})

it('throws an error on invalid path', async () => {
  expect(SharedWorker).toBeDefined()
  const worker = new SharedWorker('./web-worker/some-invalid-path')
  const event = await new Promise<ErrorEvent>((resolve) => {
    worker.onerror = (e) => {
      resolve(e)
    }
  })
  expect(event).toBeInstanceOf(ErrorEvent)
  // Error is in different context when running in VM. This is consistent with jest.
  if (!import.meta.env.VITEST_VM_POOL) {
    expect(event.error).toBeInstanceOf(Error)
  }
  expect(event.error.message).toContain('Failed to load')
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
