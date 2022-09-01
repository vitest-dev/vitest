import { afterEach, beforeEach, expect, test, vi } from 'vitest'

// https://github.com/vitest-dev/vitest/issues/1940
beforeEach(() => {
  vi.doMock('/data', () => ({
    data: {
      state: 'STARTED',
    },
  }))
})
afterEach(() => {
  vi.doUnmock('/data')
})

test('first import', async () => {
  // @ts-expect-error I know this
  const { data } = await import('/data')
  data.state = 'STOPPED'
  expect(data.state).toBe('STOPPED')
})

test('secnod import should had been re-mock', async () => {
  // @ts-expect-error I know this
  const { data } = await import('/data')
  expect(data.state).toBe('STARTED')
})
