import { expect, it } from 'vitest'
import MyWorker from '../src/worker?worker'

it('throws syntax errorm if no arguments are provided', () => {
  const worker = new MyWorker()

  // @ts-expect-error requires at least one argument
  expect(() => worker.postMessage()).toThrowError(SyntaxError)
  expect(() => worker.postMessage(undefined)).not.toThrowError()
  expect(() => worker.postMessage(null)).not.toThrowError()
})
