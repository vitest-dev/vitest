/**
 * @vitest-environment jsdom
 */
import { expect, it } from 'vitest'

import MyWorker from '../src/worker?worker'

const testWorker = (worker: Worker) => {
  return new Promise((resolve) => {
    worker.postMessage('hello')
    worker.onmessage = (e) => {
      expect(e.data).toBe('hello world')

      resolve(0)
    }
  })
}

it('worker exists', async() => {
  expect(Worker).toBeDefined()
})

it('simple worker', async() => {
  expect.assertions(1)

  await testWorker(new MyWorker())
})

it('can test workers several times', async() => {
  expect.assertions(1)

  await testWorker(new MyWorker())
})

it('worker with url', async() => {
  expect.assertions(1)

  await testWorker(new Worker(new URL('../src/worker.ts', import.meta.url)))
})
