import { getType } from '@vitest/utils'
import type { ExpectStatic, MatcherState, Tester } from './types'
import { ASYMMETRIC_MATCHERS_OBJECT, GLOBAL_EXPECT, JEST_MATCHERS_OBJECT, MATCHERS_OBJECT } from './constants'

if (!Object.prototype.hasOwnProperty.call(globalThis, MATCHERS_OBJECT)) {
  const globalState = new WeakMap<ExpectStatic, MatcherState>()
  const matchers = Object.create(null)
  const assymetricMatchers = Object.create(null)
  Object.defineProperty(globalThis, MATCHERS_OBJECT, {
    get: () => globalState,
  })
  Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
    configurable: true,
    get: () => ({
      state: globalState.get((globalThis as any)[GLOBAL_EXPECT]),
      customEqualityTesters: [],
      matchers,
    }),
  })
  Object.defineProperty(globalThis, ASYMMETRIC_MATCHERS_OBJECT, {
    get: () => assymetricMatchers,
  })
}

export function getState<State extends MatcherState = MatcherState>(expect: ExpectStatic): State {
  return (globalThis as any)[MATCHERS_OBJECT].get(expect)
}

export function setState<State extends MatcherState = MatcherState>(
  state: Partial<State>,
  expect: ExpectStatic,
): void {
  const map = (globalThis as any)[MATCHERS_OBJECT]
  const current = map.get(expect) || {}
  Object.assign(current, state)
  map.set(expect, current)
}

export function getCustomEqualityTesters(): Array<Tester> {
  const { customEqualityTesters } = (globalThis as any)[JEST_MATCHERS_OBJECT]
  return customEqualityTesters
}

export function addCustomEqualityTesters(testers: Array<Tester>): void {
  if (!Array.isArray(testers)) {
    throw new TypeError(
      `expect.customEqualityTesters should receive array type, but got: ${getType(testers)}`,
    )
  }

  (globalThis as any)[JEST_MATCHERS_OBJECT].customEqualityTesters.push(...testers)
}
