/**
 * Copies the stack trace from one error to another.
 *
 * If the source has no stack trace, the target is left unchanged.
 *
 * @param target - The error to copy the stack trace to.
 * @param source - The error to copy the stack trace from.
 * @returns The target error with the updated stack trace.
 */
export function copyStackTrace(target: Error, source: Error): Error {
  if (source.stack !== undefined) {
    target.stack = source.stack.replace(source.message, target.message)
  }
  return target
}
