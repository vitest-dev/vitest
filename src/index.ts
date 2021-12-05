export * from './types'
export * from './suite'
export * from './config'
export * from './integrations/chai'
export * from './integrations/sinon'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Chai {
    interface Assertion {
      // Snapshot
      toMatchSnapshot(message?: string): Assertion
      matchSnapshot(message?: string): Assertion

      // Jest compact
      toEqual(expected: any): void
      toStrictEqual(expected: any): void
      toBe(expected: any): void
      toContain(item: any): void
      toBeTruthy(): void
      toBeFalsy(): void
      toBeNaN(): void
      toBeUndefined(): void
      toBeNull(): void
      toBeDefined(): void
    }
    interface ExpectStatic {
      addSnapshotSerializer: import('pretty-format').Plugin
    }
  }
}
