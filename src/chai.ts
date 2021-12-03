export { assert, should, expect } from 'chai'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Chai {
    interface Assertion {
      toMatchSnapshot(message?: string): Assertion
      matchSnapshot(message?: string): Assertion
    }
    interface ExpectStatic {
      addSnapshotSerializer: import('pretty-format').Plugin
    }
  }
}
