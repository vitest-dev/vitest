import { getCurrentTest } from '@vitest/runner'
import { expect, test } from 'vitest'

test('expect.soft tracks failures for matchSnapshot', () => {
  expect.soft({ time: new Date() }).matchSnapshot()
  expect.soft({ uuid: crypto.randomUUID() }).matchSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  resetFailingTestState()
  resetUnmatchedSnapshotFailures()
})

test('expect.soft tracks failures for toMatchSnapshot', async () => {
  expect.soft({ time: new Date() }).toMatchSnapshot()
  expect.soft({ uuid: crypto.randomUUID() }).toMatchSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  resetFailingTestState()
  resetUnmatchedSnapshotFailures()
})

test('expect.soft tracks failures for toMatchFileSnapshot', async () => {
  await expect.soft({ time: new Date() }).toMatchFileSnapshot('./__snapshots__/custom/custom_snapshot1')
  await expect.soft({ uuid: crypto.randomUUID() }).toMatchFileSnapshot('./__snapshots__/custom/custom_snapshot2')

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  resetFailingTestState()
  resetUnmatchedSnapshotFailures()
})

test('expect.soft tracks failures for toThrowErrorMatchingSnapshot', () => {
  expect.soft({ time: '2011-11-11' }).toThrowErrorMatchingSnapshot()
  expect.soft({ uuid: 'eb10615a-e798-4630-8209-4ab082345e78' }).toThrowErrorMatchingSnapshot()

  expect(getCurrentTest()?.result?.errors).toHaveLength(2)
  resetFailingTestState()
  resetUnmatchedSnapshotFailures()
})

test('expect.soft fails if run with toMatchInlineSnapshot', () => {
  let exceptionThrown = false
  try {
    expect.soft(1).toMatchInlineSnapshot(`1`)
  }
  catch (error: any) {
    expect(error?.message).toContain('toMatchInlineSnapshot cannot be used with "soft"')
    exceptionThrown = true
  }

  expect(exceptionThrown).toBe(true)
  resetUnmatchedSnapshotFailures()
})

test('expect.soft fails if run with toThrowErrorMatchingInlineSnapshot', () => {
  let exceptionThrown = false
  try {
    expect.soft(() => {
      throw new Error('1')
    }).toThrowErrorMatchingInlineSnapshot(`[Error: 2]`)
  }
  catch (error: any) {
    expect(error?.message).toContain('toThrowErrorMatchingInlineSnapshot cannot be used with "soft"')
    exceptionThrown = true
  }

  expect(exceptionThrown).toBe(true)
  resetUnmatchedSnapshotFailures()
})

function resetFailingTestState() {
  getCurrentTest()!.result!.state = 'run'
}

function resetUnmatchedSnapshotFailures() {
  const snapshotState = expect.getState().snapshotState
  if (snapshotState?.unmatched) {
    snapshotState.unmatched = 0
  }
}
