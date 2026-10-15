export function get() {}

export function post() {}

export function isHttpError(error) {
  return error?.isHttpError === true
}

export default {
  get,
  post,
  isHttpError,
}
