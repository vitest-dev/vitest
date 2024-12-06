import { expect, test, vi } from 'vitest'
import { workerDep } from '../src/web-worker/mock/worker-dep'
import '@vitest/web-worker'

vi.mock(import('../src/web-worker/mock/worker-dep'), () => ({ workerDep: () => 'mocked' }))

test('mock', async () => {
  expect(workerDep()).toMatchInlineSnapshot(`"mocked"`)
  const worker = new Worker(new URL('../src/web-worker/mock/worker', import.meta.url))
  const data = await new Promise((resolve) => {
    worker.addEventListener('message', (e) => {
      resolve(e.data)
    })
  })
  expect(data).toMatchInlineSnapshot(`"mocked"`)
})
