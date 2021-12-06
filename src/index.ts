import { UserOptions } from './types'

export * from './types'
export * from './suite'
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
      toBeTruthy(): void
      toBeFalsy(): void
      toBeNaN(): void
      toBeUndefined(): void
      toBeNull(): void
      toBeDefined(): void
      toBeInstanceOf(c: any): void
      toBeCalledTimes(n: number): void
      toBeCalledOnce(): void
      toBeCalled(): void
      toHaveBeenCalled(): void
    }
    interface ExpectStatic {
      addSnapshotSerializer: import('pretty-format').Plugin
    }
  }
}
