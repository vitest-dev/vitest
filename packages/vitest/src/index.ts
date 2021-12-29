import type {
  Plugin as PrettyFormatPlugin,
} from 'pretty-format'
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
      addSnapshotSerializer(plugin: PrettyFormatPlugin): void
      not: AsymmetricMatchersContaining
    }

    interface JestAssertions {
      // Snapshot
      toMatchSnapshot(message?: string): void
      toMatchInlineSnapshot(snapshot?: string, message?: string): void
      toThrowErrorMatchingSnapshot(message?: string): void
      toThrowErrorMatchingInlineSnapshot(snapshot?: string, message?: string): void
      matchSnapshot(message?: string): void

      // Jest compact
      toEqual(expected: any): void
      toStrictEqual(expected: any): void
      toBe(expected: any): void
      toMatch(expected: string | RegExp): void
      toMatchObject(expected: any): void
      toContain(item: any): void
      toContainEqual(item: any): void
      toBeTruthy(): void
      toBeFalsy(): void
      toBeGreaterThan(num: number): void
      toBeGreaterThanOrEqual(num: number): void
      toBeLessThan(num: number): void
      toBeLessThanOrEqual(num: number): void
      toBeNaN(): void
      toBeUndefined(): void
      toBeNull(): void
      toBeDefined(): void
      toBeInstanceOf(c: any): void
      toBeCalledTimes(n: number): void
      toHaveLength(l: number): void
      toHaveProperty(p: string, value?: any): void
      toBeCloseTo(number: number, numDigits?: number): void
      toHaveBeenCalledTimes(n: number): void
      toHaveBeenCalledOnce(): void
      toHaveBeenCalled(): void
      toBeCalled(): void
      toHaveBeenCalledWith(...args: any[]): void
      toBeCalledWith(...args: any[]): void
      toHaveBeenNthCalledWith(n: number, ...args: any[]): void
      nthCalledWith(n: number, ...args: any[]): void
      toHaveBeenLastCalledWith(...args: any[]): void
      lastCalledWith(...args: any[]): void
      toThrow(expected?: string | RegExp): void
      toThrowError(expected?: string | RegExp): void
      toReturn(): void
      toHaveReturned(): void
      toReturnTimes(times: number): void
      toHaveReturnedTimes(times: number): void
      toReturnWith(value: any): void
      toHaveReturnedWith(value: any): void
      toHaveLastReturnedWith(value: any): void
      lastReturnedWith(value: any): void
      toHaveNthReturnedWith(nthCall: number, value: any): void
      nthReturnedWith(nthCall: number, value: any): void
    }

    type Promisify<O> = {
      [K in keyof O]: O[K] extends (...args: infer A) => infer R
        ? O extends R
          ? Promisify<O[K]>
          : (...args: A) => Promise<R>
        : O[K]
    }

    interface Assertion extends JestAssertions {
      resolves: Promisify<Assertion>
      rejects: Promisify<Assertion>

      // Chai
      chaiEqual(expected: any): void
    }
  }
}
