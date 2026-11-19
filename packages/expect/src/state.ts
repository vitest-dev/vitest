import type { ExpectStatic, MatcherState, Tester } from './types'
import {
  ASYMMETRIC_MATCHERS_OBJECT,
  EXPECT_STATE_TARGET,
  GLOBAL_EXPECT,
  JEST_MATCHERS_OBJECT,
  MATCHERS_OBJECT,
} from './constants'

if (!Object.hasOwn(globalThis, MATCHERS_OBJECT)) {
  const globalState = new WeakMap<ExpectStatic, MatcherState>()
  const matchers = Object.create(null)
  const customEqualityTesters: Array<Tester> = []
  const asymmetricMatchers = Object.create(null)
  // `configurable` so that vm pools can strip the accessors from a disposed
  // context: the getters capture the expect state, which would otherwise keep
  // the whole test-file world reachable from the leaked context shell
  Object.defineProperty(globalThis, MATCHERS_OBJECT, {
    configurable: true,
    get: () => globalState,
  })
  Object.defineProperty(globalThis, JEST_MATCHERS_OBJECT, {
    configurable: true,
    get: () => ({
      state: getState((globalThis as any)[GLOBAL_EXPECT]),
      matchers,
      customEqualityTesters,
    }),
  })
  Object.defineProperty(globalThis, ASYMMETRIC_MATCHERS_OBJECT, {
    configurable: true,
    get: () => asymmetricMatchers,
  })
}

function getStateTarget(expect: ExpectStatic): ExpectStatic {
  return (globalThis as any)[EXPECT_STATE_TARGET]?.(expect) || expect
}

/**
 * Gets the matcher state of `expect`. With `experimental.asyncTaskContext`,
 * the global `expect` uses the state of the current test's `context.expect`.
 */
export function getState<State extends MatcherState = MatcherState>(expect: ExpectStatic): State {
  return getOwnState(getStateTarget(expect))
}

/**
 * Sets the matcher state of `expect`, redirected like `getState`.
 */
export function setState<State extends MatcherState = MatcherState>(
  state: Partial<State>,
  expect: ExpectStatic,
): void {
  setOwnState(state, getStateTarget(expect))
}

/**
 * Gets the state stored on `expect` itself, even when `getState` would
 * redirect it to the current test's `context.expect`.
 */
export function getOwnState<State extends MatcherState = MatcherState>(
  expect: ExpectStatic,
): State {
  return (globalThis as any)[MATCHERS_OBJECT].get(expect)
}

/**
 * Sets the state stored on `expect` itself, without the redirect of `setState`.
 */
export function setOwnState<State extends MatcherState = MatcherState>(
  state: Partial<State>,
  expect: ExpectStatic,
): void {
  const map = (globalThis as any)[MATCHERS_OBJECT]
  const current = map.get(expect)
  // so it keeps getters from `testPath`
  const next = Object.defineProperties(current || {}, Object.getOwnPropertyDescriptors(state))
  if (!current) {
    map.set(expect, next)
  }
}
