// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
export function serializeError(val: any): any {
  if (!val)
    return val

  if (typeof val === 'function')
    return `Function<${val.name}>`
  if (typeof val !== 'object')
    return val
  if (val instanceof Promise || 'then' in val)
    return 'Promise'
  if (typeof Element !== 'undefined' && val instanceof Element)
    return val.tagName

  Object.keys(val).forEach((key) => {
    val[key] = serializeError(val[key])
  })

  return val
}

export function processError(err: any) {
  if (!err)
    return err
  // stack is not serialized in worker communication
  // we stringify it first
  if (err.stack)
    err.stackStr = String(err.stack)
  if (err.name)
    err.nameStr = String(err.name)

  return serializeError(err)
}
