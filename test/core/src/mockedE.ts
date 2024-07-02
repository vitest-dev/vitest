export const symbolFn = Symbol.for('symbolFn')

export class MockedE {
  public testFn(arg: string) {
    return arg.repeat(2)
  }

  public [symbolFn](arg: string) {
    return arg.repeat(2)
  }
}
