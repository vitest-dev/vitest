import { expect, test } from 'vitest'

// The file name contains a "+" on purpose: the orchestrator passes the test
// file path as the `iframeId` query parameter of the tester iframe URL. If it
// is not encoded, the "+" is decoded back as a space, the tester never matches
// the orchestrator events, and the run hangs at "0 passed".
test('runs a test from a file whose path contains a plus sign', () => {
  expect(true).toBe(true)
})
