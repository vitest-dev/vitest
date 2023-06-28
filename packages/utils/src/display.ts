// since this is already part of Vitest via Chai, we can just reuse it without increasing the size of bundle
// @ts-expect-error doesn't have types
import { inspect as loupe } from 'loupe'

interface LoupeOptions {
  showHidden?: boolean | undefined
  depth?: number | null | undefined
  colors?: boolean | undefined
  customInspect?: boolean | undefined
  showProxy?: boolean | undefined
  maxArrayLength?: number | null | undefined
  maxStringLength?: number | null | undefined
  breakLength?: number | undefined
  compact?: boolean | number | undefined
  sorted?: boolean | ((a: string, b: string) => number) | undefined
  getters?: 'get' | 'set' | boolean | undefined
  numericSeparator?: boolean | undefined
  truncate?: number
}

const formatRegExp = /%[sdjifoOcj%]/g

export function format(...args: unknown[]) {
  if (typeof args[0] !== 'string') {
    const objects = []
    for (let i = 0; i < args.length; i++)
      objects.push(inspect(args[i], { depth: 0, colors: false, compact: 3 }))
    return objects.join(' ')
  }

  const len = args.length
  let i = 1
  const template = args[0]
  let str = String(template).replace(formatRegExp, (x) => {
    if (x === '%%')
      return '%'
    if (i >= len)
      return x
    switch (x) {
      case '%s': {
        const value = args[i++]
        if (typeof value === 'bigint')
          return `${value.toString()}n`
        if (typeof value === 'number' && value === 0 && 1 / value < 0)
          return '-0'
        if (typeof value === 'object' && value !== null)
          return inspect(value, { depth: 0, colors: false, compact: 3 })
        return String(value)
      }
      case '%d': {
        const value = args[i++]
        if (typeof value === 'bigint')
          return `${value.toString()}n`
        return Number(value).toString()
      }
      case '%i': {
        const value = args[i++]
        if (typeof value === 'bigint')
          return `${value.toString()}n`
        return Number.parseInt(String(value)).toString()
      }
      case '%f': return Number.parseFloat(String(args[i++])).toString()
      case '%o': return inspect(args[i++], { showHidden: true, showProxy: true })
      case '%O': return inspect(args[i++])
      case '%c': {
        i++
        return ''
      }
      case '%j':
        try {
          return JSON.stringify(args[i++])
        }
        catch (err: any) {
          if (err.message.includes('circular structure'))
            return '[Circular]'
          throw err
        }
      default:
        return x
    }
  })

  for (let x = args[i]; i < len; x = args[++i]) {
    if (x === null || typeof x !== 'object')
      str += ` ${x}`

    else
      str += ` ${inspect(x)}`
  }
  return str
}

export function inspect(obj: unknown, options: LoupeOptions = {}) {
  if (options.truncate === 0)
    options.truncate = Infinity
  return loupe(obj, options)
}

export function objDisplay(obj: unknown, options: LoupeOptions = {}): string {
  const truncateThreshold = options.truncate ?? 40
  const str = inspect(obj, options)
  const type = Object.prototype.toString.call(obj)

  if (truncateThreshold && str.length >= truncateThreshold) {
    if (type === '[object Function]') {
      const fn = obj as () => void
      return (!fn.name || fn.name === '')
        ? '[Function]'
        : `[Function: ${fn.name}]`
    }
    else if (type === '[object Array]') {
      return `[ Array(${(obj as []).length}) ]`
    }
    else if (type === '[object Object]') {
      const keys = Object.keys(obj as {})
      const kstr = keys.length > 2
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
