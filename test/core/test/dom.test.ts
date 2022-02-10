/**
 * @vitest-environment jsdom
 */
import { expect, it } from 'vitest'
import MyWorker from '../src/worker?worker'

it('jsdom', () => {
  expect(window).toBeDefined()

  const dom = document.createElement('a')
  dom.href = 'https://vitest.dev'
  dom.textContent = '<Vitest>'

  expect(dom.outerHTML).toEqual('<a href="https://vitest.dev">&lt;Vitest&gt;</a>')
})

it('worker', async() => {
  expect(Worker).toBeDefined()

  const worker = new MyWorker()
  worker.postMessage('hello')

  // worker.onerror = (e) => {
  //   throw new Error(e.message)
  // }

  await new Promise(resolve => setTimeout(resolve, 1000))
})
