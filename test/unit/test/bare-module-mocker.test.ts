import { afterEach, beforeEach, expect, test } from 'vitest'
import { BareModuleMocker } from '../../../packages/vitest/src/runtime/moduleRunner/bareModuleMocker'
import { Traces } from '../../../packages/vitest/src/utils/traces'

const traces = new Traces({ enabled: false })

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

beforeEach(() => {
  BareModuleMocker.pendingIds = []
})

afterEach(() => {
  BareModuleMocker.pendingIds = []
})

test('resolveMocks preserves same-path doMock registration order when resolution finishes out of order', async () => {
  let resolveCount = 0
  const mocker = new BareModuleMocker({
    traces,
    root: '/root',
    moduleDirectories: [],
    getCurrentTestFilepath: () => '/root/basic.test.ts',
    async resolveId() {
      resolveCount += 1
      if (resolveCount === 1) {
        await delay(10)
      }
      return {
        id: '/target.ts',
        file: '/root/target.ts',
        url: '/target.ts',
      }
    },
  })

  const firstFactory = () => ({ value: 'first' })
  const secondFactory = () => ({ value: 'second' })

  mocker.queueMock('./target', '/root/basic.test.ts', firstFactory)
  mocker.queueMock('./target', '/root/basic.test.ts', secondFactory)

  await mocker.resolveMocks()

  const mock = mocker.getDependencyMock('/target.ts')
  expect(mock?.type).toBe('manual')
  expect(mock).toHaveProperty('factory', secondFactory)
})
