import type { RandomExampleLookup } from '@vitest/utils/random-source'
import { formatExamplePath } from '../../utils/example-literal'

/**
 * The values of 1 example for the outer `span` and `many` calls of a random source and its
 * forks. A call with a key returns the value and reads no numbers. The values of a fork are in an
 * object with the label of the fork, and the values of a label that runs more than 1 time are in
 * an array with the key `$label`, 1 value for each call.
 */
export class RandomExample implements RandomExampleLookup {
  // the paths of the keys that the calls read, and the first call that read each key
  private readonly uses = new Map<string, { fork: boolean; call: string }>()
  private readonly calls = new Map<string, number>()
  // the open calls of `span` and `many` on all sources
  private depth = 0

  constructor(private readonly values: Record<string, unknown>) {}

  call<T>(path: readonly string[], method: 'span' | 'many', label: string, run: () => T): T {
    if (!this.depth) {
      const found = this.find(path, method, label)
      if (found) {
        return found.value as T
      }
    }
    this.depth++
    try {
      return run()
    } finally {
      this.depth--
    }
  }

  /** The paths of the keys that no call used, for example `network.delay` or `$node[2]`. */
  getUnusedKeys(): string[] {
    const unused: string[] = []
    const visit = (values: Record<string, unknown>, path: string[]) => {
      for (const [key, value] of Object.entries(values)) {
        const keyPath = [...path, key]
        const use = this.uses.get(JSON.stringify(keyPath))
        if (key.startsWith('$') && Array.isArray(value)) {
          const indexes = value.flatMap((_, index) =>
            this.uses.has(JSON.stringify([...keyPath, String(index)])) ? [] : [index],
          )
          if (indexes.length === value.length) {
            unused.push(formatExamplePath(keyPath))
          } else {
            unused.push(...indexes.map((index) => formatExamplePath(keyPath, index)))
          }
        } else if (use?.fork && isPlainObject(value)) {
          visit(value, keyPath)
        } else if (!use) {
          unused.push(formatExamplePath(keyPath))
        }
      }
    }
    visit(this.values, [])
    return unused
  }

  /** The paths of the outer calls, for example `network.delay`. */
  getCallPaths(): string[] {
    return [...this.calls.keys()]
  }

  private find(
    path: readonly string[],
    method: string,
    label: string,
  ): { value: unknown } | undefined {
    const call = `random${path.map((fork) => `.fork(${JSON.stringify(fork)})`).join('')}.${method}(${JSON.stringify(label)})`
    const name = formatExamplePath([...path, label])
    const index = this.calls.get(name) ?? 0
    this.calls.set(name, index + 1)
    let values = this.values
    for (const [depth, fork] of path.entries()) {
      const forkValues = Object.hasOwn(values, fork) ? values[fork] : undefined
      // another value is an unused key, or the value of a call with the label of the fork
      if (!isPlainObject(forkValues)) {
        return undefined
      }
      this.use(path.slice(0, depth + 1), true, call)
      values = forkValues
    }
    const listKey = `$${label}`
    const items = getExampleItems(values, label, path)
    if (items) {
      if (index >= items.length) {
        return undefined
      }
      this.use([...path, listKey, String(index)], false, call)
      return { value: items[index] }
    }
    if (!Object.hasOwn(values, label)) {
      return undefined
    }
    if (index > 0) {
      throw new Error(
        `${call} runs more than 1 time. Use "${formatExamplePath([...path, listKey])}" in the example with 1 value for each call.`,
      )
    }
    this.use([...path, label], false, call)
    return { value: values[label] }
  }

  private use(path: readonly string[], fork: boolean, call: string): void {
    const key = JSON.stringify(path)
    const use = this.uses.get(key)
    if (!use) {
      this.uses.set(key, { fork, call })
    } else if (use.fork !== fork) {
      const [forkCall, valueCall] = fork ? [call, use.call] : [use.call, call]
      throw new Error(
        `${forkCall} reads the example key "${formatExamplePath(path)}" as the values of a fork, and ${valueCall} reads it as a value. Rename 1 of the labels.`,
      )
    }
  }
}

/**
 * The values of `$label` in the values of an example or a fork. Throws a `TypeError` if the values
 * have both `label` and `$label`, or if `$label` is not an array with at least 1 value.
 */
export function getExampleItems(
  values: Record<string, unknown>,
  label: string,
  path: readonly string[] = [],
  example = 'The example',
): unknown[] | undefined {
  const listKey = `$${label}`
  if (!Object.hasOwn(values, listKey)) {
    return undefined
  }
  const name = formatExamplePath([...path, listKey])
  if (Object.hasOwn(values, label)) {
    throw new TypeError(
      `${example} has the keys "${formatExamplePath([...path, label])}" and "${name}". Use only "${name}", with 1 value for each call.`,
    )
  }
  const items = values[listKey]
  if (!Array.isArray(items)) {
    throw new TypeError(
      `${example} has the key "${name}" with a value that is not an array, received ${typeof items}. Use an array with 1 value for each call.`,
    )
  }
  if (!items.length) {
    throw new TypeError(
      `${example} has the key "${name}" with an empty array. Use an array with 1 value for each call.`,
    )
  }
  return items
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const proto = Object.getPrototypeOf(value)
  return proto === null || Object.getPrototypeOf(proto) === null
}
