import type { Plugin as PrettyFormatPlugin } from 'pretty-format'
import type { MatcherState, MatchersObject } from './integrations/chai/types'
import type { Constructable, InlineConfig } from './types'

export { suite, test, describe, it } from './runtime/suite'

export * from './runtime/hooks'
export * from './integrations/chai'
export * from './integrations/jest-mock'
export * from './integrations/vi'

export * from './types'
export * from './api/types'

type VitestInlineConfig = InlineConfig

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }
}

interface AsymmetricMatchersContaining {
  stringContaining(expected: string): any
  objectContaining(expected: any): any
  arrayContaining(expected: unknown[]): any
  stringMatching(expected: string | RegExp): any
}

type Promisify<O> = {
  [K in keyof O]: O[K] extends (...args: infer A) => infer R
    ? O extends R
      ? Promisify<O[K]>
      : (...args: A) => Promise<R>
    : O[K]
}

declare global {
  // support augmenting jest.Matchers by other libraries
  namespace jest {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface Matchers<R, T = {}> {}
  }

  namespace Vi {
    interface ExpectStatic extends Chai.ExpectStatic, AsymmetricMatchersContaining {
      <T>(actual: T, message?: string): Vi.Assertion<T>

      extend(expects: MatchersObject): void
      assertions(expected: number): void
      hasAssertions(): void
      anything(): any
      any(constructor: unknown): any
      addSnapshotSerializer(plugin: PrettyFormatPlugin): void
      getState(): MatcherState
      setState(state: Partial<MatcherState>): void
      not: AsymmetricMatchersContaining
    }

    interface JestAssertion<T = any> extends jest.Matchers<void, T> {
      // Snapshot
      toMatchSnapshot<U extends { [P in keyof T]: any }>(snapshot: Partial<U>, message?: string): void
      toMatchSnapshot(message?: string): void
      matchSnapshot<U extends { [P in keyof T]: any }>(snapshot: Partial<U>, message?: string): void
      matchSnapshot(message?: string): void
      toMatchInlineSnapshot<U extends { [P in keyof T]: any }>(properties: Partial<U>, snapshot?: string, message?: string): void
      toMatchInlineSnapshot(snapshot?: string, message?: string): void
      toThrowErrorMatchingSnapshot(message?: string): void
      toThrowErrorMatchingInlineSnapshot(snapshot?: string, message?: string): void

      // Jest compact
      toEqual<E>(expected: E): void
      toStrictEqual<E>(expected: E): void
      toBe<E>(expected: E): void
      toMatch(expected: string | RegExp): void
      toMatchObject<E extends {} | any[]>(expected: E): void
      toContain<E>(item: E): void
      toContainEqual<E>(item: E): void
      toBeTruthy(): void
      toBeFalsy(): void
      toBeGreaterThan(num: number | bigint): void
      toBeGreaterThanOrEqual(num: number | bigint): void
      toBeLessThan(num: number | bigint): void
      toBeLessThanOrEqual(num: number | bigint): void
      toBeNaN(): void
      toBeUndefined(): void
      toBeNull(): void
      toBeDefined(): void
      toBeTypeOf(expected: 'bigint' | 'boolean' | 'function' | 'number' | 'object' | 'string' | 'symbol' | 'undefined'): void
      toBeInstanceOf<E>(expected: E): void
      toBeCalledTimes(times: number): void
      toHaveLength(length: number): void
      toHaveProperty<E>(property: string, value?: E): void
      toBeCloseTo(number: number, numDigits?: number): void
      toHaveBeenCalledTimes(times: number): void
      toHaveBeenCalledOnce(): void
      toHaveBeenCalled(): void
      toBeCalled(): void
      toHaveBeenCalledWith<E extends any[]>(...args: E): void
      toBeCalledWith<E extends any[]>(...args: E): void
      toHaveBeenNthCalledWith<E extends any[]>(n: number, ...args: E): void
      nthCalledWith<E extends any[]>(nthCall: number, ...args: E): void
      toHaveBeenLastCalledWith<E extends any[]>(...args: E): void
      lastCalledWith<E extends any[]>(...args: E): void
      toThrow(expected?: string | Constructable | RegExp | Error): void
      toThrowError(expected?: string | Constructable | RegExp | Error): void
      toReturn(): void
      toHaveReturned(): void
      toReturnTimes(times: number): void
      toHaveReturnedTimes(times: number): void
      toReturnWith<E>(value: E): void
      toHaveReturnedWith<E>(value: E): void
      toHaveLastReturnedWith<E>(value: E): void
      lastReturnedWith<E>(value: E): void
      toHaveNthReturnedWith<E>(nthCall: number, value: E): void
      nthReturnedWith<E>(nthCall: number, value: E): void
    }

    // eslint-disable-next-line @typescript-eslint/prefer-ts-expect-error
    // @ts-ignore build namspace conflict
    type VitestAssertion<A, T> = {
      [K in keyof A]: A[K] extends Chai.Assertion
        ? Assertion<T>
        : A[K] extends (...args: any[]) => any
          ? A[K] // not converting function since they may contain overload
          : VitestAssertion<A[K], T>
    } & ((type: string, message?: string) => Assertion)

    interface Assertion<T = any> extends VitestAssertion<Chai.Assertion, T>, JestAssertion<T> {
      resolves: Promisify<Assertion<T>>
      rejects: Promisify<Assertion<T>>
    }
  }
}
