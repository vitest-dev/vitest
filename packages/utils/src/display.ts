import type { PrettyFormatOptions } from '@vitest/pretty-format'
import {
  format as prettyFormat,
  plugins as prettyFormatPlugins,
} from '@vitest/pretty-format'
// since this is already part of Vitest via Chai, we can just reuse it without increasing the size of bundle
import * as loupe from 'loupe'

type Inspect = (value: unknown, options: Options) => string
interface Options {
  showHidden: boolean
  depth: number
  colors: boolean
  customInspect: boolean
  showProxy: boolean
  maxArrayLength: number
  breakLength: number
  truncate: number
  seen: unknown[]
  inspect: Inspect
  stylize: (value: string, styleType: string) => string
}

type LoupeOptions = Partial<Options>

const {
  AsymmetricMatcher,
  DOMCollection,
  DOMElement,
  Immutable,
  ReactElement,
  ReactTestComponent,
} = prettyFormatPlugins

const PLUGINS = [
  ReactTestComponent,
  ReactElement,
  DOMElement,
  DOMCollection,
  Immutable,
  AsymmetricMatcher,
]

export interface StringifyOptions extends PrettyFormatOptions {
  maxLength?: number
}

export function stringify(
  object: unknown,
  maxDepth = 10,
  { maxLength, ...options }: StringifyOptions = {},
): string {
  const MAX_LENGTH = maxLength ?? 10000
  let result

  try {
    result = prettyFormat(object, {
      maxDepth,
      escapeString: false,
      // min: true,
      plugins: PLUGINS,
      ...options,
    })
  }
  catch {
    result = prettyFormat(object, {
      callToJSON: false,
      maxDepth,
      escapeString: false,
      // min: true,
      plugins: PLUGINS,
      ...options,
    })
  }

  return result.length >= MAX_LENGTH && maxDepth > 1
    ? stringify(object, Math.floor(maxDepth / 2))
    : result
}

const formatRegExp = /%[sdjifoOc%]/g

export function format(...args: unknown[]): string {
  if (typeof args[0] !== 'string') {
    const objects = []
    for (let i = 0; i < args.length; i++) {
      objects.push(inspect(args[i], { depth: 0, colors: false }))
    }
    return objects.join(' ')
  }

  const len = args.length
  let i = 1
  const template = args[0]
  let str = String(template).replace(formatRegExp, (x) => {
    if (x === '%%') {
      return '%'
    }
    if (i >= len) {
      return x
    }
    switch (x) {
      case '%s': {
        const value = args[i++]
        if (typeof value === 'bigint') {
          return `${value.toString()}n`
        }
        if (typeof value === 'number' && value === 0 && 1 / value < 0) {
          return '-0'
        }
        if (typeof value === 'object' && value !== null) {
          return inspect(value, { depth: 0, colors: false })
        }
        return String(value)
      }
      case '%d': {
        const value = args[i++]
        if (typeof value === 'bigint') {
          return `${value.toString()}n`
        }
        return Number(value).toString()
      }
      case '%i': {
        const value = args[i++]
        if (typeof value === 'bigint') {
          return `${value.toString()}n`
        }
        return Number.parseInt(String(value)).toString()
      }
      case '%f':
        return Number.parseFloat(String(args[i++])).toString()
      case '%o':
        return inspect(args[i++], { showHidden: true, showProxy: true })
      case '%O':
        return inspect(args[i++])
      case '%c': {
        i++
        return ''
      }
      case '%j':
        try {
          return JSON.stringify(args[i++])
        }
        catch (err: any) {
          const m = err.message
          if (
            // chromium
            m.includes('circular structure')
            // safari
            || m.includes('cyclic structures')
            // firefox
            || m.includes('cyclic object')
          ) {
            return '[Circular]'
          }
          throw err
        }
      default:
        return x
    }
  })

  for (let x = args[i]; i < len; x = args[++i]) {
    if (x === null || typeof x !== 'object') {
      str += ` ${x}`
    }
    else {
      str += ` ${inspect(x)}`
    }
  }
  return str
}

export function inspect(obj: unknown, options: LoupeOptions = {}): string {
  if (options.truncate === 0) {
    options.truncate = Number.POSITIVE_INFINITY
  }
  return loupe.inspect(obj, options)
}

export function objDisplay(obj: unknown, options: LoupeOptions = {}): string {
  if (typeof options.truncate === 'undefined') {
    options.truncate = 40
  }
  const str = inspect(obj, options)
  const type = Object.prototype.toString.call(obj)

  if (type === '[object String]') {
    return str.slice(1, -1)
  }

  if (options.truncate && str.length >= options.truncate) {
    if (type === '[object Function]') {
      const fn = obj as () => void
      return !fn.name ? '[Function]' : `[Function: ${fn.name}]`
    }
    else if (type === '[object Array]') {
      return `[ Array(${(obj as []).length}) ]`
    }
    else if (type === '[object Object]') {
      const keys = Object.keys(obj as object)
      const kstr
        = keys.length > 2
          ? `${keys.splice(0, 2).join(', ')}, ...`
          : keys.join(', ')
      return `{ Object (${kstr}) }`
    }
    else {
      return str
    }
  }
  return str
}
