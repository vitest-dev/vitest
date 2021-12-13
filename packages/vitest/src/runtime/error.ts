// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
function unserialize(err: any): any {
  if (typeof err !== 'object') return err

  Object.keys(err).forEach((key) => {
    const val = err[key]

    if (typeof val === 'function')
      err[key] = `Function<${val.name}>`
    if (typeof val !== 'object') return
    if ('then' in val)
      err[key] = 'Promise'
    if (typeof Element !== 'undefined' && val instanceof Element)
      err[key] = val.tagName

    unserialize(err[key])
  })

  return err
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

  return unserialize(err)
}
