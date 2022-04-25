import { expect, isFirstRun, it, runOnce } from 'vitest'

let dummy = 0

const one = runOnce(() => {
  dummy += 1
  return 1
})

const two = await runOnce(async() => {
  dummy += 1
  return 2
})

it('runOnce', async() => {
  expect(one).toBe(1)
  expect(two).toBe(2)

  // edit the file to trigger the hmr and dummy should be 0
  expect(dummy).toBe(2)
})

it('isFirstRun', () => {
  // edit the file and this will fail
  expect(isFirstRun()).toBe(true)
})
