// Serialization support utils.

function cloneByOwnProperties(value: any) {
  // Clones the value's properties into a new Object. The simpler approach of
  // Object.assign() won't work in the case that properties are not enumerable.
  return Object.getOwnPropertyNames(value).reduce(
    (clone, prop) => ({
      ...clone,
      [prop]: value[prop],
    }),
    {},
  )
}

/**
 * Replacer function for serialization methods such as JS.stringify() or
 * flatted.stringify().
 */
export function stringifyReplace(key: string, value: any) {
  if (value instanceof Error) {
    const cloned = cloneByOwnProperties(value)
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      ...cloned,
    }
  }
  else {
    return value
  }
}
