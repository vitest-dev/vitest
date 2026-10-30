// JSON drops `undefined` in objects and turns it into `null` in arrays
const UNDEFINED_VALUE = '__vitest_undefined__'

export function replaceUndefined(value: unknown): unknown {
  return value === undefined ? UNDEFINED_VALUE : value
}

export function reviveUndefined(_key: string, value: unknown): unknown {
  return value === UNDEFINED_VALUE ? undefined : value
}
