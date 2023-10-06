import { expect, it } from 'vitest'
import MySharedWorker from '../src/sharedWorker?sharedworker'

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
  const worker = new SharedWorker(new URL('../src/sharedWorker.ts', import.meta.url))
  expect(worker).toBeTruthy()

  await expect(sendEventMessage(worker, 'event')).resolves.toBe('event')
  await expect(sendOnMessage(worker, 'event')).resolves.toBe('event')
})

it('doesn\'t trigger events, if closed', async () => {
  const worker = new MySharedWorker()
  worker.port.close()
  await new Promise((resolve) => {
    worker.port.addEventListener('message', () => {
      expect.fail('should not trigger message')
    })
    worker.port.postMessage('event')
    setTimeout(resolve, 100)
  })
})
