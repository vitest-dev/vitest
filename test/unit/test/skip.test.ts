import EventEmitter from 'node:events'
import { expect, it } from 'vitest'

const sleep = (ms?: number) => new Promise(resolve => setTimeout(resolve, ms))

it('correctly skips sync tests', ({ skip }) => {
  skip()
  expect(1).toBe(2)
})

it('correctly skips async tests with skip before async', async ({ skip }) => {
  await sleep(100)
  skip()
  expect(1).toBe(2)
})

it('correctly skips async tests with async after skip', async ({ skip }) => {
  skip()
  await sleep(100)
  expect(1).toBe(2)
})

it('correctly skips tests with callback', ({ skip }) => {
  const emitter = new EventEmitter()
  emitter.on('test', () => {
    skip()
  })
  emitter.emit('test')
  expect(1).toBe(2)
})

it('correctly skips tests with async callback', ({ skip }) => {
  const emitter = new EventEmitter()
  emitter.on('test', async () => {
    skip()
  })
  emitter.emit('test')
  expect(1).toBe(2)
})
