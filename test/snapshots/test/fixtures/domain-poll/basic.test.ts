import { expect, test } from 'vitest'
import { kvAdapter } from '../domain/basic'

expect.addSnapshotDomain(kvAdapter)

test('stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return { name: 'a', age: '23' }
  }, { interval: 10 }).toMatchDomainSnapshot('kv')
  expect(trial).toBe(2)
})

test('throw then stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 3) {
      throw new Error(`Fail at ${trial}`)
    }
    return { name: 'b', age: '23' }
  }, { interval: 10 }).toMatchDomainSnapshot('kv')
  expect(trial).toBe(5)
})

test('unstable then stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 3) return { status: 'loading', trial } // unstable
    return { status: 'done' } // then stable
  }, { interval: 10 }).toMatchDomainSnapshot('kv')
  expect(trial).toBe(5)
})

test('multiple poll snapshots', async () => {
  await expect.poll(() => {
    return { x: '1' }
  }, { interval: 10 }).toMatchDomainSnapshot('kv')

  await expect.poll(() => {
    return { y: '2' }
  }, { interval: 10 }).toMatchDomainSnapshot('kv')
})

test('non-poll alongside poll', async () => {
  expect({ static: 'value' }).toMatchDomainSnapshot('kv')

  await expect.poll(() => {
    return { polled: 'value' }
  }, { interval: 10 }).toMatchDomainSnapshot('kv')

  expect({ another: 'static' }).toMatchDomainSnapshot('kv')
})
