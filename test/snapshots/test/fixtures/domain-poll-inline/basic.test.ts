import { expect, test } from 'vitest'
import { kvAdapter } from '../domain/basic'

expect.addSnapshotDomain(kvAdapter)

test('stable', async () => {
  let trial = 0
  await expect.poll(() => {
    trial++;
    // --- STABLE TEST POLL ---
    return { name: 'a', age: '23' }
  }, { timeout: 100 }).toMatchDomainInlineSnapshot('', 'kv')
  expect(trial).toBe(1)
})

// test('throw then stable', async () => {
//   let trial = 0
//   await expect.poll(() => {
//     trial++
//     if (trial <= 1) {
//       throw new Error(`Fail at ${trial}`)
//     }
//     return { name: 'b', age: '23' }
//   }).toMatchDomainInlineSnapshot('', 'kv')
//   expect(trial).toBe(2)
// })

// test('unstable', async () => {
//   let trial = 0
//   await expect.poll(() => {
//     trial++
//     return { name: 'c', __UNSTABLE_TRIAL__: trial }
//   }).toMatchDomainInlineSnapshot('', 'kv')
// })

// // #6: multiple poll+snapshot in same test — verifies probe peek counter invariant
// test('multiple poll snapshots', async () => {
//   await expect.poll(() => {
//     return { x: '1' }
//   }, { timeout: 100 }).toMatchDomainInlineSnapshot('', 'kv')

//   await expect.poll(() => {
//     return { y: '2' }
//   }, { timeout: 100 }).toMatchDomainInlineSnapshot('', 'kv')
// })

// // #7: non-poll alongside poll — verifies no interference
// test('non-poll alongside poll', async () => {
//   expect({ static: 'value' }).toMatchDomainInlineSnapshot(`static=value`, 'kv')
//   await expect.poll(() => {
//     return { polled: 'value' }
//   }, { timeout: 100 }).toMatchDomainInlineSnapshot('', 'kv')

//   expect({ another: 'static' }).toMatchDomainInlineSnapshot('', 'kv')
// })
