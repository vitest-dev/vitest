import { RealDate } from '../integrations/mock/date'
import type { Arrayable, DeepMerge, Nullable } from '../types'

function isFinalObj(obj: any) {
  return obj === Object.prototype || obj === Function.prototype || obj === RegExp.prototype
}

function collectOwnProperties(obj: any, collector: Set<string | symbol>) {
  const props = Object.getOwnPropertyNames(obj)
  const symbs = Object.getOwnPropertySymbols(obj)

  props.forEach(prop => collector.add(prop))
  symbs.forEach(symb => collector.add(symb))
}

export function getAllProperties(obj: any) {
  const allProps = new Set<string | symbol>()
  let curr = obj
  do {
    // we don't need propterties from these
    if (isFinalObj(curr))
      break
    collectOwnProperties(curr, allProps)
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

function getOwnProperties(obj: any) {
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

function random(seed: number) {
  const x = Math.sin(seed++) * 10000
  return x - Math.floor(x)
}

export function randomize<T>(array: T[], seed = RealDate.now()): T[] {
  let length = array.length

  while (length) {
    const index = Math.floor(random(seed) * length--)

    const previous = array[length]
    array[length] = array[index]
    array[index] = previous
    ++seed
  }

  return array
}
