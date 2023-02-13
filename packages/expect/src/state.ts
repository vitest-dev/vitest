import type { MatcherState } from './types'
import { GLOBAL_EXPECT, JEST_MATCHERS_OBJECT, MATCHERS_OBJECT } from './constants'

if (!Object.prototype.hasOwnProperty.call(globalThis, MATCHERS_OBJECT)) {
  const globalState = new WeakMap<Vi.ExpectStatic, MatcherState>()
  const matchers = Object.create(null)
  Object.defineProperty(globalThis, MATCHERS_OBJECT, {
    get: () => globalState,
  })
  Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
    configurable: true,
    get: () => ({
      state: globalState.get((globalThis as any)[GLOBAL_EXPECT]),
      matchers,
    }),
  })
}

export const getState = <State extends MatcherState = MatcherState>(expect: Vi.ExpectStatic): State =>
  (globalThis as any)[MATCHERS_OBJECT].get(expect)

export const setState = <State extends MatcherState = MatcherState>(
  state: Partial<State>,
  expect: Vi.ExpectStatic,
): void => {
  const map = (globalThis as any)[MATCHERS_OBJECT]
  const current = map.get(expect) || {}
  Object.assign(current, state)
  map.set(expect, current)
}
