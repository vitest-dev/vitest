import type { ExpectStatic, MatcherState, Tester } from './types'
import {
  ASYMMETRIC_MATCHERS_OBJECT,
  GLOBAL_EXPECT,
  JEST_MATCHERS_OBJECT,
  MATCHERS_OBJECT,
} from './constants'

if (!Object.prototype.hasOwnProperty.call(globalThis, MATCHERS_OBJECT)) {
  const globalState = new WeakMap<ExpectStatic, MatcherState>()
  const matchers = Object.create(null)
  const customEqualityTesters: Array<Tester> = []
  const asymmetricMatchers = Object.create(null)
  Object.defineProperty(globalThis, MATCHERS_OBJECT, {
    get: () => globalState,
  })
  Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
    configurable: true,
    get: () => ({
      state: globalState.get((globalThis as any)[GLOBAL_EXPECT]),
      matchers,
      customEqualityTesters,
    }),
  })
  Object.defineProperty(globalThis, ASYMMETRIC_MATCHERS_OBJECT, {
    get: () => asymmetricMatchers,
  })
}

export function getState<State extends MatcherState = MatcherState>(
  expect: ExpectStatic,
): State {
  return (globalThis as any)[MATCHERS_OBJECT].get(expect)
}

export function setState<State extends MatcherState = MatcherState>(
  state: Partial<State>,
  expect: ExpectStatic,
): void {
  const map = (globalThis as any)[MATCHERS_OBJECT]
  const current = map.get(expect) || {}
  // so it keeps getters from `testPath`
  const results = Object.defineProperties(current, {
    ...Object.getOwnPropertyDescriptors(current),
    ...Object.getOwnPropertyDescriptors(state),
  })
  map.set(expect, results)
}
