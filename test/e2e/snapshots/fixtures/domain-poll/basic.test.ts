import { expect, test } from 'vitest'
import "../domain/basic-extend"

test('stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    return { name: 'a', age: '23' }
  }, { interval: 10 }).toMatchKvSnapshot()
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
  }, { interval: 10 }).toMatchKvSnapshot()
  expect(trial).toBe(5)
})

test('unstable then stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++
    if (trial <= 3) return { status: 'loading', trial } // unstable
    return { status: 'done' } // then stable
  }, { interval: 10 }).toMatchKvSnapshot()
  expect(trial).toBe(5)
})

test('multiple poll snapshots', async () => {
  await expect.poll(() => {
    return { x: '1' }
  }, { interval: 10 }).toMatchKvSnapshot()

  await expect.poll(() => {
    return { y: '2' }
  }, { interval: 10 }).toMatchKvSnapshot()
})

test('non-poll alongside poll', async () => {
  expect({ static: 'value' }).toMatchKvSnapshot()
  await expect.poll(() => {
    return { polled: 'value' }
  }, { interval: 10 }).toMatchKvSnapshot()

  expect({ another: 'static' }).toMatchKvSnapshot()
})

test('empty snapshot', async () => {
  await expect.poll(() => {
    return {}
  }, { interval: 10 }).toMatchKvSnapshot()
})
