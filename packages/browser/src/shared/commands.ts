// JSON turns `undefined` array items into `null`
const UNDEFINED_ARGUMENT = '__vitest_undefined_argument__'

export function serializeCommandArguments(args: unknown[]): unknown[] {
  return args.map((arg) => (arg === undefined ? UNDEFINED_ARGUMENT : arg))
}

export function deserializeCommandArguments(args: unknown[]): unknown[] {
  return args.map((arg) => (arg === UNDEFINED_ARGUMENT ? undefined : arg))
}
