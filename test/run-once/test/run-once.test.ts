import { expect, it, runOnce } from 'vitest'

let dummy = 0

const one = await runOnce(() => {
  dummy += 1
  return 1
})

const two = await runOnce(async() => {
  dummy += 1
  return 2
})

it('run once', async() => {
  expect(one).toBe(1)
  expect(two).toBe(2)

  // edit the file to trigger the hmr and dummy should be 0
  expect(dummy).toBe(2)
})
