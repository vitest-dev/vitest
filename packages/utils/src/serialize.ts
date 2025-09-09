// utils is bundled for any environment and might not support `Element`
declare class Element {
  tagName: string
}

const IS_RECORD_SYMBOL = '@@__IMMUTABLE_RECORD__@@'
const IS_COLLECTION_SYMBOL = '@@__IMMUTABLE_ITERABLE__@@'

function isImmutable(v: any) {
  return v && (v[IS_COLLECTION_SYMBOL] || v[IS_RECORD_SYMBOL])
}

const OBJECT_PROTO = Object.getPrototypeOf({})

function getUnserializableMessage(err: unknown) {
  if (err instanceof Error) {
    return `<unserializable>: ${err.message}`
  }
  if (typeof err === 'string') {
    return `<unserializable>: ${err}`
  }
  return '<unserializable>'
}

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
export function serializeValue(val: any, seen: WeakMap<WeakKey, any> = new WeakMap()): any {
  if (!val || typeof val === 'string') {
    return val
  }
  if (val instanceof Error && 'toJSON' in val && typeof val.toJSON === 'function') {
    const jsonValue = val.toJSON()

    if (jsonValue && jsonValue !== val && typeof jsonValue === 'object') {
      if (typeof val.message === 'string') {
        safe(() => jsonValue.message ??= normalizeErrorMessage(val.message))
      }
      if (typeof val.stack === 'string') {
        safe(() => jsonValue.stack ??= val.stack)
      }
      if (typeof val.name === 'string') {
        safe(() => jsonValue.name ??= val.name)
      }
      if (val.cause != null) {
        safe(() => jsonValue.cause ??= serializeValue(val.cause, seen))
      }
    }
    return serializeValue(jsonValue, seen)
  }
  if (typeof val === 'function') {
    return `Function<${val.name || 'anonymous'}>`
  }
  if (typeof val === 'symbol') {
    return val.toString()
  }
  if (typeof val !== 'object') {
    return val
  }
  if (typeof Buffer !== 'undefined' && val instanceof Buffer) {
    return `<Buffer(${val.length}) ...>`
  }
  if (typeof Uint8Array !== 'undefined' && val instanceof Uint8Array) {
    return `<Uint8Array(${val.length}) ...>`
  }
  // cannot serialize immutables as immutables
  if (isImmutable(val)) {
    return serializeValue(val.toJSON(), seen)
  }
  if (
    val instanceof Promise
    || (val.constructor && val.constructor.prototype === 'AsyncFunction')
  ) {
    return 'Promise'
  }
  if (typeof Element !== 'undefined' && val instanceof Element) {
    return val.tagName
  }
  if (typeof val.toJSON === 'function') {
    return serializeValue(val.toJSON(), seen)
  }

  if (seen.has(val)) {
    return seen.get(val)
  }

  if (Array.isArray(val)) {
    // eslint-disable-next-line unicorn/no-new-array -- we need to keep sparse arrays ([1,,3])
    const clone: any[] = new Array(val.length)
    seen.set(val, clone)
    val.forEach((e, i) => {
      try {
        clone[i] = serializeValue(e, seen)
      }
      catch (err) {
        clone[i] = getUnserializableMessage(err)
      }
    })
    return clone
  }
  else {
    // Objects with `Error` constructors appear to cause problems during worker communication
    // using `MessagePort`, so the serialized error object is being recreated as plain object.
    const clone = Object.create(null)
    seen.set(val, clone)

    let obj = val
    while (obj && obj !== OBJECT_PROTO) {
      Object.getOwnPropertyNames(obj).forEach((key) => {
        if (key in clone) {
          return
        }
        try {
          clone[key] = serializeValue(val[key], seen)
        }
        catch (err) {
          // delete in case it has a setter from prototype that might throw
          delete clone[key]
          clone[key] = getUnserializableMessage(err)
        }
      })
      obj = Object.getPrototypeOf(obj)
    }
    if (val instanceof Error) {
      safe(() => val.message = normalizeErrorMessage(val.message))
    }
    return clone
  }
}

function safe(fn: () => void) {
  try {
    return fn()
  }
  catch {
    // ignore
  }
}

function normalizeErrorMessage(message: string) {
  return message.replace(/__(vite_ssr_import|vi_import)_\d+__\./g, '')
}
