import { afterAll, beforeEach, describe, expect, test, vi } from 'vitest'

const mockServer = { setup: vi.fn(), teardown: vi.fn() }
const FnA = vi.fn()

const myTest = test.extend<{
  autoFixture: void
  normalFixture: any[]
}>({
  autoFixture: [async ({}, use) => {
    await mockServer.setup()
    await use()
    await mockServer.teardown()
  }, { auto: true }],

  normalFixture: [async () => {
    await FnA()
  }, {}],
})

describe('fixture with options', () => {
  describe('automatic fixture', () => {
    beforeEach(() => {
      expect(mockServer.setup).toBeCalledTimes(1)
    })

    afterAll(() => {
      expect(mockServer.setup).toBeCalledTimes(1)
      expect(mockServer.teardown).toBeCalledTimes(1)
    })

    myTest('should setup mock server', () => {
      expect(mockServer.setup).toBeCalledTimes(1)
    })
  })

  describe('normal fixture', () => {
    myTest('it is not a fixture with options', ({ normalFixture }) => {
      expect(FnA).not.toBeCalled()
      expect(normalFixture).toBeInstanceOf(Array)
    })
  })
})
