import { expect, test } from 'vitest'
import { kvAdapter } from '../domain/basic'

expect.addSnapshotDomain(kvAdapter)

// --- TEST CASES ---
test('stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return { name: 'a', age: '23' }
  }, { interval: 10 }).toMatchDomainInlineSnapshot(`
    name=a
    age=23
  `, 'kv')
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
  }, { interval: 10 }).toMatchDomainInlineSnapshot(`
    name=b
    age=23
  `, 'kv')
  expect(trial).toBe(5)
})

test('unstable then stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 3) return { status: 'loading', trial } // unstable
    return { status: 'done' } // then stable
  }, { interval: 10 }).toMatchDomainInlineSnapshot(`
    status=done
  `, 'kv')
  expect(trial).toBe(5)
})

test('multiple poll snapshots', async () => {
  await expect.poll(() => {
    return { x: '1' }
  }, { interval: 10 }).toMatchDomainInlineSnapshot(`
    x=1
  `, 'kv')

  await expect.poll(() => {
    return { y: '2' }
  }, { interval: 10 }).toMatchDomainInlineSnapshot(`
    y=2
  `, 'kv')
})

test('non-poll alongside poll', async () => {
  expect({ static: 'value' }).toMatchDomainInlineSnapshot(`
    static=value
  `, 'kv')

  await expect.poll(() => {
    return { polled: 'value' }
  }, { interval: 10 }).toMatchDomainInlineSnapshot(`
    polled=value
  `, 'kv')

  expect({ another: 'static' }).toMatchDomainInlineSnapshot(`
    another=static
  `, 'kv')
})
