const noop = () => {}

export interface AssertType {
  <T>(value: T): void
}

export const assertType: AssertType = noop
