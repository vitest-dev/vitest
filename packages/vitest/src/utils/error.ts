interface ErrorOptions {
  message?: string
  stackTraceLimit?: number
}

export function createSimpleStackTrace(options?: ErrorOptions) {
  const { message = 'error', stackTraceLimit = 1 } = options || {}
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
