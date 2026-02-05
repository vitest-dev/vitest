import { expect, test, vi } from 'vitest'

// copy of
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
  myEqual('left', 'right')
})

test('async', async () => {
  await myEqualAsync('left', 'right')
})

test('soft', () => {
  myEqualSoft('left', 'right')
})

test('soft async', async () => {
  await myEqualSoftAsync('left', 'right')
})

// debug

const manual = helper((a: any, b: any) => {
  expect(a).toEqual(b)
})

const manualAsync = helper(async (a: any, b: any) => {
  await new Promise(r => setTimeout(r, 1))
  expect(a).toEqual(b)
})

test("manual", () => {
  manual('manual', 'no')
})

test("manual async", async () => {
  await manualAsync('manual async', 'no')
})

function helper<F extends (...args: any) => any>(fn: F): F {
  function __MANUAL_HELPER__(...args: any[]): any {
    const result = fn(...args);
    if (result && typeof result === "object" && typeof result.then === "function") {
      return (async function __MANUAL_HELPER_ASYNC__() {
        return await result;
      })();
    }
    return result;
  }
  return __MANUAL_HELPER__ as F;
}
