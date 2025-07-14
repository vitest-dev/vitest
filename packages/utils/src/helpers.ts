import type { Arrayable, Nullable } from './types'

interface CloneOptions {
  forceWritable?: boolean
}

interface ErrorOptions {
  message?: string
  stackTraceLimit?: number
}

/**
 * Get original stacktrace without source map support the most performant way.
 * - Create only 1 stack frame.
 * - Rewrite prepareStackTrace to bypass "support-stack-trace" (usually takes ~250ms).
 */
export function createSimpleStackTrace(options?: ErrorOptions): string {
  const { message = '$$stack trace error', stackTraceLimit = 1 }
    = options || {}
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

export function notNullish<T>(v: T | null | undefined): v is NonNullable<T> {
  return v != null
}

export function assertTypes(
  value: unknown,
  name: string,
  types: string[],
): void {
  const receivedType = typeof value
  const pass = types.includes(receivedType)
  if (!pass) {
    throw new TypeError(
      `${name} value must be ${types.join(' or ')}, received "${receivedType}"`,
    )
  }
}

export function isPrimitive(value: unknown): boolean {
  return (
    value === null || (typeof value !== 'function' && typeof value !== 'object')
  )
}

export function slash(path: string): string {
  return path.replace(/\\/g, '/')
}

// convert RegExp.toString to RegExp
export function parseRegexp(input: string): RegExp {
  // Parse input
  // eslint-disable-next-line regexp/no-misleading-capturing-group
  const m = input.match(/(\/?)(.+)\1([a-z]*)/i)

  // match nothing
  if (!m) {
    return /$^/
  }

  // Invalid flags
  // eslint-disable-next-line regexp/optimal-quantifier-concatenation
  if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
    return new RegExp(input)
  }

  // Create the regular expression
  return new RegExp(m[2], m[3])
}

export function toArray<T>(array?: Nullable<Arrayable<T>>): Array<T> {
  if (array === null || array === undefined) {
    array = []
  }

  if (Array.isArray(array)) {
    return array
  }

  return [array]
}

export function isObject(item: unknown): boolean {
  return item != null && typeof item === 'object' && !Array.isArray(item)
}

function isFinalObj(obj: any) {
  return (
    obj === Object.prototype
    || obj === Function.prototype
    || obj === RegExp.prototype
  )
}

export function getType(value: unknown): string {
  return Object.prototype.toString.apply(value).slice(8, -1)
}

function collectOwnProperties(
  obj: any,
  collector: Set<string | symbol> | ((key: string | symbol) => void),
) {
  const collect
    = typeof collector === 'function'
      ? collector
      : (key: string | symbol) => collector.add(key)
  Object.getOwnPropertyNames(obj).forEach(collect)
  Object.getOwnPropertySymbols(obj).forEach(collect)
}

export function getOwnProperties(obj: any): (string | symbol)[] {
  const ownProps = new Set<string | symbol>()
  if (isFinalObj(obj)) {
    return []
  }
  collectOwnProperties(obj, ownProps)
  return Array.from(ownProps)
}

const defaultCloneOptions: CloneOptions = { forceWritable: false }

export function deepClone<T>(
  val: T,
  options: CloneOptions = defaultCloneOptions,
): T {
  const seen = new WeakMap()
  return clone(val, seen, options)
}

export function clone<T>(
  val: T,
  seen: WeakMap<any, any>,
  options: CloneOptions = defaultCloneOptions,
): T {
  let k: any, out: any
  if (seen.has(val)) {
    return seen.get(val)
  }
  if (Array.isArray(val)) {
    out = Array.from({ length: (k = val.length) })
    seen.set(val, out)
    while (k--) {
      out[k] = clone(val[k], seen, options)
    }
    return out as any
  }

  if (Object.prototype.toString.call(val) === '[object Object]') {
    out = Object.create(Object.getPrototypeOf(val))
    seen.set(val, out)
    // we don't need properties from prototype
    const props = getOwnProperties(val)
    for (const k of props) {
      const descriptor = Object.getOwnPropertyDescriptor(val, k)
      if (!descriptor) {
        continue
      }
      const cloned = clone((val as any)[k], seen, options)
      if (options.forceWritable) {
        Object.defineProperty(out, k, {
          enumerable: descriptor.enumerable,
          configurable: true,
          writable: true,
          value: cloned,
        })
      }
      else if ('get' in descriptor) {
        Object.defineProperty(out, k, {
          ...descriptor,
          get() {
            return cloned
          },
        })
      }
      else {
        Object.defineProperty(out, k, {
          ...descriptor,
          value: cloned,
        })
      }
    }
    return out
  }

  return val
}

export function noop(): void {}

export function objectAttr(
  source: any,
  path: string,
  defaultValue = undefined,
): any {
  // a[3].b -> a.3.b
  const paths = path.replace(/\[(\d+)\]/g, '.$1').split('.')
  let result = source
  for (const p of paths) {
    result = (new Object(result) as any)[p]
    if (result === undefined) {
      return defaultValue
    }
  }
  return result
}

export type DeferPromise<T> = Promise<T> & {
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

/**
 * If code starts with a function call, will return its last index, respecting arguments.
 * This will return 25 - last ending character of toMatch ")"
 * Also works with callbacks
 * ```
 * toMatch({ test: '123' });
 * toBeAliased('123')
 * ```
 */
export function getCallLastIndex(code: string): number | null {
  let charIndex = -1
  let inString: string | null = null
  let startedBracers = 0
  let endedBracers = 0
  let beforeChar: string | null = null
  while (charIndex <= code.length) {
    beforeChar = code[charIndex]
    charIndex++
    const char = code[charIndex]

    const isCharString = char === '"' || char === '\'' || char === '`'

    if (isCharString && beforeChar !== '\\') {
      if (inString === char) {
        inString = null
      }
      else if (!inString) {
        inString = char
      }
    }

    if (!inString) {
      if (char === '(') {
        startedBracers++
      }
      if (char === ')') {
        endedBracers++
      }
    }

    if (startedBracers && endedBracers && startedBracers === endedBracers) {
      return charIndex
    }
  }
  return null
}

export function isNegativeNaN(val: number): boolean {
  if (!Number.isNaN(val)) {
    return false
  }
  const f64 = new Float64Array(1)
  f64[0] = val
  const u32 = new Uint32Array(f64.buffer)
  const isNegative = u32[1] >>> 31 === 1

  return isNegative
}

function toString(v: any) {
  return Object.prototype.toString.call(v)
}

function isPlainObject(val: any): val is object {
  return (
    toString(val) === '[object Object]'
    && (!val.constructor || val.constructor.name === 'Object')
  )
}

function isMergeableObject(item: any): item is object {
  return isPlainObject(item) && !Array.isArray(item)
}

/**
 * Deep merge :P
 *
 * Will merge objects only if they are plain
 *
 * Do not merge types - it is very expensive and usually it's better to case a type here
 */
export function deepMerge<T extends object = object>(
  target: T,
  ...sources: any[]
): T {
  if (!sources.length) {
    return target as any
  }

  const source = sources.shift()
  if (source === undefined) {
    return target as any
  }

  if (isMergeableObject(target) && isMergeableObject(source)) {
    (Object.keys(source) as (keyof T)[]).forEach((key) => {
      const _source = source as T
      if (isMergeableObject(_source[key])) {
        if (!target[key]) {
          target[key] = {} as any
        }

        deepMerge(target[key] as any, _source[key])
      }
      else {
        target[key] = _source[key] as any
      }
    })
  }

  return deepMerge(target, ...sources)
}
