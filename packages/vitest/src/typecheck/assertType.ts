export interface AssertType {
  <T>(value: T): void
}

export const assertType: AssertType = function assertType() {}
