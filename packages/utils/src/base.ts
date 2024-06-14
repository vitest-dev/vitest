interface ErrorOptions {
  message?: string
  stackTraceLimit?: number
}
/**
 * Get original stacktrace without source map support the most performant way.
 * - Create only 1 stack frame.
 * - Rewrite prepareStackTrace to bypass "support-stack-trace" (usually takes ~250ms).
 */
export function createSimpleStackTrace(options?: ErrorOptions) {
  const { message = '$$stack trace error', stackTraceLimit = 1 }
    = options || {}
  const limit = Error.stackTraceLimit
  const prepareStackTrace = Error.prepareStackTrace
  Error.stackTraceLimit = stackTraceLimit
  Error.prepareStackTrace = e => e.stack
  const err = new Error(message)
  const stackTrace = err.stack || ''
  Error.prepareStackTrace = prepareStackTrace
  Error.stackTraceLimit = limit
  return stackTrace
}
