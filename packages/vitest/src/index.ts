import type { Any, Anything, ArrayContaining, ObjectContaining, StringMatching } from './integrations/chai/jest-asymmetric-matchers'
import type { MatchersObject } from './integrations/chai/types'
import type { InlineConfig } from './types'

type VitestInlineConfig = InlineConfig

export { suite, test, describe, it } from './runtime/suite'
export * from './runtime/hooks'
export * from './integrations/chai'
export * from './integrations/jest-mock'
export * from './integrations/vi'

export * from './types'
export * from './api/types'

export type { Spy, SpyFn } from 'tinyspy'

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }
}

interface AsymmetricMatchersContaining {
  stringContaining(expected: string): void
  objectContaining(expected: any): ObjectContaining
  arrayContaining(expected: unknown[]): ArrayContaining
  stringMatching(expected: string | RegExp): StringMatching
}

declare global {
  namespace Chai {
    interface ExpectStatic extends AsymmetricMatchersContaining {
      extend(expects: MatchersObject): void
      assertions(expected: number): void
      hasAssertions(): void
      anything(): Anything
      any(constructor: unknown): Any
      not: AsymmetricMatchersContaining
    }

    interface JestAssertions<T = void> {
      // Snapshot
      toMatchSnapshot(message?: string): T
      toMatchInlineSnapshot(snapshot?: string, message?: string): T
      matchSnapshot(message?: string): T

      // Jest compact
      toEqual(expected: any): T
      toStrictEqual(expected: any): T
      toBe(expected: any): T
      toMatch(expected: string | RegExp): T
      toMatchObject(expected: any): T
      toContain(item: any): T
      toContainEqual(item: any): T
      toBeTruthy(): T
      toBeFalsy(): T
      toBeGreaterThan(num: number): T
      toBeGreaterThanOrEqual(num: number): T
      toBeLessThan(num: number): T
      toBeLessThanOrEqual(num: number): T
      toBeNaN(): T
      toBeUndefined(): T
      toBeNull(): T
      toBeDefined(): T
      toBeInstanceOf(c: any): T
      toBeCalledTimes(n: number): T
      toHaveLength(l: number): T
      toHaveProperty(p: string, value?: any): T
      toBeCloseTo(number: number, numDigits?: number): T
      toHaveBeenCalledTimes(n: number): T
      toHaveBeenCalledOnce(): T
      toHaveBeenCalled(): T
      toBeCalled(): T
      toHaveBeenCalledWith(...args: any[]): T
      toBeCalledWith(...args: any[]): T
      toHaveBeenNthCalledWith(n: number, ...args: any[]): T
      nthCalledWith(n: number, ...args: any[]): T
      toHaveBeenLastCalledWith(...args: any[]): T
      lastCalledWith(...args: any[]): T
      toThrow(expected?: string | RegExp): T
      toThrowError(expected?: string | RegExp): T
      toReturn(): T
      toHaveReturned(): T
      toReturnTimes(times: number): T
      toHaveReturnedTimes(times: number): T
      toReturnWith(value: any): T
      toHaveReturnedWith(value: any): T
      toHaveLastReturnedWith(value: any): T
      lastReturnedWith(value: any): T
      toHaveNthReturnedWith(nthCall: number, value: any): T
      nthReturnedWith(nthCall: number, value: any): T
    }

    type Promisify<O> = {
      [K in keyof O]: O[K] extends (...args: infer A) => infer R ? O extends R ? Promisify<O[K]> : (...args: A) => Promise<R> : O[K]
    }

    interface Assertion extends JestAssertions {
      resolves: Promisify<Assertion>
      rejects: Promisify<Assertion>

      // Chai
      chaiEqual(expected: any): void
    }
  }
}
