import { expect, test } from 'vitest'
import { kvAdapter } from '../domain/basic'

expect.addSnapshotDomain(kvAdapter)

test('stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++;
    // --- STABLE TEST POLL ---
    return { name: 'a', age: '23' }
  }, { timeout: 100 }).toMatchDomainInlineSnapshot(`
    name=a
    age=23
  `, 'kv')
  expect(trial).toBe(1)
})

test('throw then stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 1) {
      throw new Error(`Fail at ${trial}`)
    }
    return { name: 'b', age: '23' }
  }).toMatchDomainInlineSnapshot(`
    name=b
    age=23
  `, 'kv')
  expect(trial).toBe(2)
})

test('unstable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return { name: 'c', __UNSTABLE_TRIAL__: trial }
  }).toMatchDomainInlineSnapshot(`
    name=c
    __UNSTABLE_TRIAL__=1
  `, 'kv')
})
