import type { MatchersObject } from './integrations/chai/types'
import type { InlineConfig as VitestInlineConfig } from './types'

export { suite, test, describe, it } from './runtime/suite'
export * from './types'
export * from './runtime/hooks'
export * from './integrations/chai'
export * from './integrations/tinymock'

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: VitestInlineConfig
  }
}

declare global {
  namespace Chai {
    interface ExpectStatic {
      extend(expects: MatchersObject): void
      stringContaining(expected: string): void
      anything(): any
    }

    interface Assertion {
      // Chai
      chaiEqual(expected: any): void

      // Snapshot
      toMatchSnapshot(message?: string): Assertion
      toMatchInlineSnapshot(snapshot?: string, message?: string): Assertion
      matchSnapshot(message?: string): Assertion

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
  }
}
