// import * as flatted from 'flatted'

// export { parse, toJSON } from 'flatted'

// /**
//  * Replacer function for serialization methods such as JSON.stringify() or
//  * flatted.stringify(). Handles Error objects by extracting all properties.
//  */
// function stringifyReplace(_key: string, value: unknown): unknown {
//   if (value instanceof Error) {
//     const cloned = cloneByOwnProperties(value)
//     return {
//       name: value.name,
//       message: value.message,
//       stack: value.stack,
//       ...cloned,
//     }
//   }
//   return value
// }

// /**
//  * Serialize data with circular reference handling and proper Error serialization.
//  */
// export function stringify(value: unknown): string {
//   return flatted.stringify(value, stringifyReplace)
// }

import * as devalue from 'devalue'

function cloneByOwnProperties(value: object): Record<string, unknown> {
  // Clones the value's properties into a new Object. The simpler approach of
  // Object.assign() won't work in the case that properties are not enumerable.
  return Object.getOwnPropertyNames(value).reduce<Record<string, unknown>>(
    (clone, prop) => {
      clone[prop] = (value as Record<string, unknown>)[prop]
      return clone
    },
    {},
  )
}

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...cloneByOwnProperties(error),
  }
}

// https://github.com/sveltejs/devalue/blob/fcf4e88275f2e2e45b9ea70ffaa5247c8f55f057/src/stringify.js
const devalueBuiltins = new Set([
  '[object Array]',
  '[object Date]',
  '[object RegExp]',
  '[object Map]',
  '[object Set]',
  '[object URL]',
  '[object URLSearchParams]',
  '[object ArrayBuffer]',
  '[object Int8Array]',
  '[object Uint8Array]',
  '[object Uint8ClampedArray]',
  '[object Int16Array]',
  '[object Uint16Array]',
  '[object Int32Array]',
  '[object Uint32Array]',
  '[object Float32Array]',
  '[object Float64Array]',
  '[object BigInt64Array]',
  '[object BigUint64Array]',
  '[object Number]',
  '[object String]',
  '[object Boolean]',
  '[object BigInt]',
  '[object Temporal.Duration]',
  '[object Temporal.Instant]',
  '[object Temporal.PlainDate]',
  '[object Temporal.PlainTime]',
  '[object Temporal.PlainDateTime]',
  '[object Temporal.PlainMonthDay]',
  '[object Temporal.PlainYearMonth]',
  '[object Temporal.ZonedDateTime]',
])

function isCustomObject(value: unknown): value is object {
  if (!value || typeof value !== 'object') {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  if (proto === Object.prototype || proto === null) {
    return false
  }
  const tag = Object.prototype.toString.call(value)
  if (devalueBuiltins.has(tag)) {
    return false
  }
  return true
}

const customTypes = {
  stringify: {
    vi_error: (v: unknown) => v instanceof Error ? serializeError(v) : undefined,
    // handle non-pojo like flatted since devalue throws otherwise
    vi_custom: (v: unknown) => {
      if (isCustomObject(v)) {
        // mirror JSON/flatted behavior for custom toJSON
        if (typeof (v as any).toJSON === 'function') {
          return (v as any).toJSON()
        }
        return { ...v }
      }
    },
  },
  parse: {
    vi_error: (v: unknown) => v,
    vi_custom: (v: unknown) => v,
  },
}

export function parse<T = any>(text: string): T {
  return devalue.parse(text, customTypes.parse)
}

export function stringify(value: unknown): string {
  return devalue.stringify(value, customTypes.stringify)
}

export function toJSON<T>(value: T): T {
  return parse(stringify(value))
}
