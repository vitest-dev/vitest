import { expect, test } from 'vitest'
import { answer, tag } from './src/dep-10'
import { greet } from './src/spy-10'

// /__vitest_non_mock_probe__ is a marker request: it must never show up as a
// paused request in the protocol log, because a file without mocks runs with
// request interception fully disarmed
test('plain file imports real modules without interception', async () => {
  expect(tag).toBe('real-10')
  expect(answer()).toBe('real-answer-10')
  expect(greet()).toBe('real-greet-10')
  await fetch('/__vitest_non_mock_probe__').then(r => r.status, () => -1)
})
