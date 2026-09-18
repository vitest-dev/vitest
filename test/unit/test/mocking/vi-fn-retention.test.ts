import type { Mock } from 'vitest'
import v8 from 'node:v8'
import vm from 'node:vm'
import { expect, test, vi } from 'vitest'

// node exposes no public gc hook, but the flag can be flipped just long
// enough to grab one from a throwaway context
v8.setFlagsFromString('--expose-gc')
const gc = vm.runInNewContext('gc')
v8.setFlagsFromString('--no-expose-gc')

type Fn = Mock<() => unknown>

function createMocks(create: () => Fn, use: (mock: Fn) => void): WeakRef<object>[] {
  return Array.from({ length: 100 }, () => {
    const mock = create()
    use(mock)
    return new WeakRef(mock)
  })
}

async function countAlive(refs: WeakRef<object>[]): Promise<number> {
  let alive = refs.length
  for (let attempt = 0; attempt < 10 && alive > 0; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 10))
    gc()
    alive = refs.filter(ref => ref.deref()).length
  }
  return alive
}

function noop() {}

test.each([
  ['called, nothing clears them', () => vi.fn(), (mock: Fn) => mock(), noop],
  ['configured, nothing clears them', () => vi.fn(), (mock: Fn) => mock.mockReturnValue(1), noop],
  ['created with an implementation, only vi.clearAllMocks() runs', () => vi.fn(() => 1), noop, () => vi.clearAllMocks()],
  ['configured, only vi.clearAllMocks() runs', () => vi.fn(), (mock: Fn) => mock.mockReturnValue(1), () => vi.clearAllMocks()],
  ['called and configured, only vi.clearAllMocks() runs', () => vi.fn(), (mock: Fn) => {
    mock.mockReturnValue(1)
    mock()
  }, () => vi.clearAllMocks()],
])('unreferenced mocks are collected: %s', async (_, create, use, cleanup) => {
  const refs = createMocks(create, use)
  cleanup()

  expect(await countAlive(refs)).toBe(0)
})
