import type { Arrayable, Nullable } from '../types'

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
    out = {} // null
    for (k in val) {
      if (k === '__proto__') {
        Object.defineProperty(out, k, {
          value: clone((val as any)[k]),
          configurable: true,
          enumerable: true,
          writable: true,
        })
      }
      else {
        // eslint-disable-next-line no-cond-assign
        out[k] = (tmp = (val as any)[k]) && typeof tmp === 'object' ? clone(tmp) : tmp
      }
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
  array = array || []
  if (Array.isArray(array))
    return array
  return [array]
}

export function isObject(item: unknown): boolean {
  return item != null && typeof item === 'object' && !Array.isArray(item)
}

function deepMergeArray(target: any[] = [], source: any[] = []) {
  const mergedOutput = Array.from(target)

  source.forEach((sourceElement, index) => {
    const targetElement = mergedOutput[index]

    if (Array.isArray(target[index])) {
      mergedOutput[index] = deepMergeArray(target[index], sourceElement)
    }
    else if (isObject(targetElement)) {
      mergedOutput[index] = deepMerge(target[index], sourceElement)
    }
    else {
      // Source does not exist in target or target is primitive and cannot be deep merged
      mergedOutput[index] = sourceElement
    }
  })

  return mergedOutput
}

export function deepMerge(target: any, source: any): any {
  if (isObject(target) && isObject(source)) {
    if (target instanceof RegExp || source instanceof RegExp)
      return target

    const mergedOutput = { ...target }
    Object.keys(source).forEach((key) => {
      if (isObject(source[key]) && !source[key].$$typeof) {
        if (!(key in target)) Object.assign(mergedOutput, { [key]: source[key] })
        else mergedOutput[key] = deepMerge(target[key], source[key])
      }
      else if (Array.isArray(source[key])) {
        mergedOutput[key] = deepMergeArray(target[key], source[key])
      }
      else {
        Object.assign(mergedOutput, { [key]: source[key] })
      }
    })

    return mergedOutput
  }
  else if (Array.isArray(target) && Array.isArray(source)) {
    return deepMergeArray(target, source)
  }
  return target
}
