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

test('second import should have been re-mocked', async () => {
  // @ts-expect-error I know this
  const { data } = await import('/data')
  expect(data.state).toBe('STARTED')
})

test('unmock should clear modules replaced with imitation', async () => {
  vi.doMock('./fixtures/mocked-dependency')
  const { helloWorld } = await import('./fixtures/mocked-dependency')
  expect(vi.isMockFunction(helloWorld)).toBe(true)

  vi.doUnmock('./fixtures/mocked-dependency')
  const { helloWorld: unmocked } = await import('./fixtures/mocked-dependency')
  expect(vi.isMockFunction(unmocked)).toBe(false)
})
