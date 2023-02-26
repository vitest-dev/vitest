import type { Arrayable, Nullable } from './types'

export function assertTypes(value: unknown, name: string, types: string[]): void {
  const receivedType = typeof value
  const pass = types.includes(receivedType)
  if (!pass)
    throw new TypeError(`${name} value must be ${types.join(' or ')}, received "${receivedType}"`)
}

export function slash(path: string) {
  return path.replace(/\\/g, '/')
}

// convert RegExp.toString to RegExp
export function parseRegexp(input: string): RegExp {
  // Parse input
  const m = input.match(/(\/?)(.+)\1([a-z]*)/i)

  // match nothing
  if (!m)
    return /$^/

  // Invalid flags
  if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3]))
    return RegExp(input)

  // Create the regular expression
  return new RegExp(m[2], m[3])
}

export function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  if (array === null || array === undefined)
    array = []

  if (Array.isArray(array))
    return array

  return [array]
}

export function isObject(item: unknown): boolean {
  return item != null && typeof item === 'object' && !Array.isArray(item)
}

function isFinalObj(obj: any) {
  return obj === Object.prototype || obj === Function.prototype || obj === RegExp.prototype
}

export function getType(value: unknown): string {
  return Object.prototype.toString.apply(value).slice(8, -1)
}

function collectOwnProperties(obj: any, collector: Set<string | symbol> | ((key: string | symbol) => void)) {
  const collect = typeof collector === 'function' ? collector : (key: string | symbol) => collector.add(key)
  Object.getOwnPropertyNames(obj).forEach(collect)
  Object.getOwnPropertySymbols(obj).forEach(collect)
}

export function getOwnProperties(obj: any) {
  const ownProps = new Set<string | symbol>()
  if (isFinalObj(obj))
    return []
  collectOwnProperties(obj, ownProps)
  return Array.from(ownProps)
}

export function deepClone<T>(val: T): T {
  const seen = new WeakMap()
  return clone(val, seen)
}

export function clone<T>(val: T, seen: WeakMap<any, any>): T {
  let k: any, out: any
  if (seen.has(val))
    return seen.get(val)
  if (Array.isArray(val)) {
    out = Array(k = val.length)
    seen.set(val, out)
    while (k--)
      out[k] = clone(val[k], seen)
    return out as any
  }

  if (Object.prototype.toString.call(val) === '[object Object]') {
    out = Object.create(Object.getPrototypeOf(val))
    seen.set(val, out)
    // we don't need properties from prototype
    const props = getOwnProperties(val)
    for (const k of props)
      out[k] = clone((val as any)[k], seen)
    return out
  }

  return val
}

export function noop() {}

export function objectAttr(source: any, path: string, defaultValue = undefined) {
  // a[3].b -> a.3.b
  const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let result = source
  for (const p of paths) {
    result = Object(result)[p]
    if (result === undefined)
      return defaultValue
  }
  return result
}

type DeferPromise<T> = Promise<T> & {
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
}

export function createDefer<T>(): DeferPromise<T> {
  let resolve: ((value: T | PromiseLike<T>) => void) | null = null
  let reject: ((reason?: any) => void) | null = null

  const p = new Promise<T>((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  }) as DeferPromise<T>

  p.resolve = resolve!
  p.reject = reject!
  return p
}
