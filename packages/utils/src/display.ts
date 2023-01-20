import util from 'util'
// @ts-expect-error doesn't have types
import loupeImport from 'loupe'

const loupe = (typeof loupeImport.default === 'function' ? loupeImport.default : loupeImport)

export function format(...args: any[]) {
  return util.format(...args)
}

// chai utils
export function inspect(obj: unknown): string {
  return loupe(obj, {
    depth: 2,
    truncate: 40,
  })
}

export function objDisplay(obj: unknown) {
  const truncateThreshold = 40
  const str = inspect(obj)
  const type = Object.prototype.toString.call(obj)

  if (str.length >= truncateThreshold) {
    if (type === '[object Function]') {
      const fn = obj as () => void
      return !fn.name || fn.name === ''
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
