import { expect, it } from 'vitest'

import MyWorker from '../src/worker?worker'
import MyEventListenerWorker from '../src/eventListenerWorker?worker'
import MySelfWorker from '../src/selfWorker?worker'

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

  await testWorker(new Worker(new URL('../src/worker.ts', url)))
})

it('worker with invalid url throws an error', async () => {
  const url = import.meta.url
  const worker = new Worker(new URL('../src/workerInvalid-path.ts', url))
  const event = await new Promise<ErrorEvent>((resolve) => {
    worker.onerror = (e) => {
      resolve(e)
    }
  })
  expect(event).toBeInstanceOf(ErrorEvent)
  expect(event.error).toBeInstanceOf(Error)
  expect(event.error.message).toContain('Failed to load url')
})

it('self injected into worker and its deps should be equal', async () => {
  expect.assertions(4)
  expect(await testSelfWorker(new MySelfWorker())).toBeTruthy()
  // wait for clear worker mod cache
  await sleep(500)
  expect(await testSelfWorker(new MySelfWorker())).toBeTruthy()

  expect(await testSelfWorker(new Worker(new URL('../src/selfWorker.ts', import.meta.url)))).toBeTruthy()
  // wait for clear worker mod cache
  await sleep(500)
  expect(await testSelfWorker(new Worker(new URL('../src/selfWorker.ts', import.meta.url)))).toBeTruthy()
})
