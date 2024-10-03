import '@vitest/web-worker'
import { expect, test, vi } from 'vitest'
import { workerDep } from '../src/web-worker/mock/worker-dep'

vi.mock(import('../src/web-worker/mock/worker-dep'), () => ({ workerDep: () => 'mocked' }))

test('mock', async () => {
  expect(workerDep()).toMatchInlineSnapshot(`"mocked"`)
  const worker = new Worker(new URL('../src/web-worker/mock/worker', import.meta.url))
  await new Promise<void>((resolve) => {
    worker.addEventListener('message', (e) => {
      expect(e.data).toMatchInlineSnapshot(`"mocked"`)
      resolve()
    })
  })
})
