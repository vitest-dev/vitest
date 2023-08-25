// @vitest-environment jsdom

import { expect, it } from 'vitest'

it('worker with invalid url throws an error', async () => {
  const url = import.meta.url
  const worker = new Worker(new URL('../src/workerInvalid-path.ts', url))
  const event = await new Promise<ErrorEvent>((resolve) => {
    worker.onerror = (e) => {
      resolve(e)
    }
  })
  expect(event).toBeInstanceOf(ErrorEvent)
  // Error is in different context when running in VM. This is consistent with jest.
  if (!import.meta.env.VITEST_VM_POOL)
    expect(event.error).toBeInstanceOf(Error)
  expect(event.error.message).toContain('Failed to load')
})

it('throws an error on invalid path', async () => {
  expect(SharedWorker).toBeDefined()
  const worker = new SharedWorker('./some-invalid-path')
  const event = await new Promise<ErrorEvent>((resolve) => {
    worker.onerror = (e) => {
      resolve(e)
    }
  })
  expect(event).toBeInstanceOf(ErrorEvent)
  // Error is in different context when running in VM. This is consistent with jest.
  if (!import.meta.env.VITEST_VM_POOL)
    expect(event.error).toBeInstanceOf(Error)
  expect(event.error.message).toContain('Failed to load')
})
