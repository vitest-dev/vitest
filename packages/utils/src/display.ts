// eslint-disable-next-line unicorn/prefer-node-protocol
import util from 'util'
// @ts-expect-error doesn't have types
import loupeImport from 'loupe'

interface LoupeOptions {
  truncateThreshold?: number
}

const loupe = (typeof loupeImport.default === 'function' ? loupeImport.default : loupeImport)

export function format(...args: any[]) {
  return util.format(...args)
}

export function utilInspect(item: unknown, options?: util.InspectOptions) {
  return util.inspect(item, options)
}

// chai utils
export function loupeInspect(obj: unknown, options: LoupeOptions = {}): string {
  return loupe(obj, {
    depth: 2,
    truncate: options.truncateThreshold === 0
      ? Infinity
      : (options.truncateThreshold ?? 40),
  })
}

export function objDisplay(obj: unknown, options: LoupeOptions = {}): string {
  const truncateThreshold = options.truncateThreshold ?? 40
  const str = loupeInspect(obj, options)
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
