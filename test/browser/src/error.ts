interface _SomeType {
  _unused: string
}

// this should affect the line number

export function throwError(_opts?: _SomeType) {
  throw new Error('error')
}
