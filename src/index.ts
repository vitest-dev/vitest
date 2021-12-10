import { UserOptions } from './types'

export * from './types'
export * from './runtime/suite'
export * from './integrations/chai'
export * from './integrations/sinon'

declare module 'vite' {
  interface UserConfig {
    /**
     * Options for Vitest
     */
    test?: UserOptions
  }
}

declare global {
  namespace Chai {
    interface Assertion {
      // Snapshot
      toMatchSnapshot(message?: string): Assertion
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
      toBeNaN(): void
      toBeUndefined(): void
      toBeNull(): void
      toBeDefined(): void
      toBeInstanceOf(c: any): void
      toBeCalledTimes(n: number): void
      toHaveBeenCalledTimes(n: number): void
      toHaveBeenCalledOnce(): void
      toHaveBeenCalled(): void
      toBeCalled(): void
      toHaveBeenCalledWith(...args: any[]): void
      toBeCalledWith(...args: any[]): void
      toThrow(): void
      toThrowError(): void
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
