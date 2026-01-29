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

const customTypes = {
  stringify: {
    Error: (v: unknown) => v instanceof Error ? serializeError(v) : undefined,
  },
  parse: {
    Error: (v: unknown) => v,
  },
}

export function parse(text: string): unknown {
  return devalue.parse(text, customTypes.parse)
}

export function stringify(value: unknown): string {
  return devalue.stringify(value, customTypes.stringify)
}

export function toJSON(value: unknown): unknown {
  return parse(stringify(value))
}
