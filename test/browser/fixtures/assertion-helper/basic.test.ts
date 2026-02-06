import { expect, test, vi } from 'vitest'

// based on
// test/cli/fixtures/stacktraces-helper

const myEqual = vi.helper((a: any, b: any) => {
  expect(a).toEqual(b)
})

const myEqualAsync = vi.helper(async (a: any, b: any) => {
  await new Promise(r => setTimeout(r, 1))
  expect(a).toEqual(b)
})

const myEqualSoft = vi.helper((a: any, b: any) => {
  expect.soft(a).toEqual(b)
})

const myEqualSoftAsync = vi.helper(async (a: any, b: any) => {
  await new Promise(r => setTimeout(r, 1))
  expect.soft(a).toEqual(b)
})

test('sync', () => {
  myEqual('sync', 'x')
})

test('async', async () => {
  await myEqualAsync('async', 'x')
})

test('soft', () => {
  myEqualSoft('soft', 'x')
})

test('soft async', async () => {
  await myEqualSoftAsync('soft async', 'x')
})
