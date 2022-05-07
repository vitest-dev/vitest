import type { Arrayable, DeepMerge, Nullable } from '../types'

export function getAllProperties(obj: any) {
  const allProps = new Set<string | symbol>()
  let curr = obj
  do {
    // we don't need propterties from these
    if (curr === Object.prototype || curr === Function.prototype || curr === RegExp.prototype)
      break
    const props = Object.getOwnPropertyNames(curr)
    const symbs = Object.getOwnPropertySymbols(curr)

    props.forEach(prop => allProps.add(prop))
    symbs.forEach(symb => allProps.add(symb))

    // eslint-disable-next-line no-cond-assign
  } while (curr = Object.getPrototypeOf(curr))
  return Array.from(allProps)
}

export function notNullish<T>(v: T | null | undefined): v is NonNullable<T> {
  return v != null
}

export function slash(str: string) {
  return str.replace(/\\/g, '/')
}

export function mergeSlashes(str: string) {
  return str.replace(/\/\//g, '/')
}

export const noop = () => { }

export function getType(value: unknown): string {
  return Object.prototype.toString.apply(value).slice(8, -1)
}

export function clone<T>(val: T): T {
  let k: any, out: any, tmp: any

  if (Array.isArray(val)) {
    out = Array(k = val.length)
    while (k--)
      // eslint-disable-next-line no-cond-assign
      out[k] = (tmp = val[k]) && typeof tmp === 'object' ? clone(tmp) : tmp
    return out as any
  }

  if (Object.prototype.toString.call(val) === '[object Object]') {
    out = Object.create(Object.getPrototypeOf(val))
    const props = getAllProperties(val)
    for (const k of props) {
      // eslint-disable-next-line no-cond-assign
      out[k] = (tmp = (val as any)[k]) && typeof tmp === 'object' ? clone(tmp) : tmp
    }
    return out
  }

  return val
}
/**
 * Convert `Arrayable<T>` to `Array<T>`
 *
 * @category Array
 */

export function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  if (array === null || array === undefined)
    array = []

  if (Array.isArray(array))
    return array

  return [array]
}

export const toString = (v: any) => Object.prototype.toString.call(v)
export const isPlainObject = (val: any): val is object =>
  // `Object.create(null).constructor` is `undefined`
  // `{}.constructor.name` is `Object`
  // `new (class A{})().constructor.name` is `A`
  toString(val) === '[object Object]' && (!val.constructor || val.constructor.name === 'Object')

export function isObject(item: unknown): boolean {
  return item != null && typeof item === 'object' && !Array.isArray(item)
}

/**
 * Deep merge :P
 *
 * Will merge objects only if they are plain
 */
export function deepMerge<T extends object = object, S extends object = T>(target: T, ...sources: S[]): DeepMerge<T, S> {
  if (!sources.length)
    return target as any

  const source = sources.shift()
  if (source === undefined)
    return target as any

  if (isMergableObject(target) && isMergableObject(source)) {
    (Object.keys(source) as (keyof S & keyof T)[]).forEach((key) => {
      if (isMergableObject(source[key])) {
        if (!target[key])
          target[key] = {} as any

        deepMerge(target[key] as any, source[key] as any)
      }
      else {
        target[key] = source[key] as any
      }
    })
  }

  return deepMerge(target, ...sources)
}

function isMergableObject(item: any): item is Object {
  return isPlainObject(item) && !Array.isArray(item)
}

export function assertTypes(value: unknown, name: string, types: string[]): void {
  const receivedType = typeof value
  const pass = types.includes(receivedType)
  if (!pass)
    throw new TypeError(`${name} value must be ${types.join(' or ')}, received "${receivedType}"`)
}

export function stdout(): NodeJS.WriteStream {
  // @ts-expect-error Node.js maps process.stdout to console._stdout
  // eslint-disable-next-line no-console
  return console._stdout || process.stdout
}
