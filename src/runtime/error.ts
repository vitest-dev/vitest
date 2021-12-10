export function processError(err: any) {
  if (!err)
    return err
  // stack is not serialized in worker communication
  // we stringify it first
  if (err.stack)
    err.stackStr = String(err.stack)
  if (err.name)
    err.nameStr = String(err.name)
  return err
}
