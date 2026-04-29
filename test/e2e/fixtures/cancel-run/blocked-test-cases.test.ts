import { afterEach, describe, test } from 'vitest'

afterEach(async (context) => {
  (context.task.meta as any).afterEachDone = true
})

describe('these should pass', () => {
  test('one', async () => {})
  test('two', async () => {})
})

test('this test starts and gets cancelled, its after each should be called', async ({ annotate }) => {
  await annotate('Running long test, do the cancelling now!')

  await new Promise(resolve => setTimeout(resolve, 100_000))
})

describe('these should not start but should be skipped', () => {
  test('third, no after each expected', async () => {})

  describe("nested", () => {
    test('fourth, no after each expected', async () => {})
  });
})

test('fifth, no after each expected', async () => {})