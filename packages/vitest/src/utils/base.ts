import type { ModuleDefinitionLocation } from '../types/module-locations'

export { getCallLastIndex, nanoid, notNullish } from '@vitest/utils/helpers'

export function groupBy<T, K extends string | number | symbol>(
  collection: T[],
  iteratee: (item: T) => K,
): Record<K, T[]> {
  return collection.reduce((acc, item) => {
    const key = iteratee(item)
    acc[key] ||= []
    acc[key].push(item)
    return acc
  }, {} as Record<K, T[]>)
}

export function stdout(): NodeJS.WriteStream {
  // @ts-expect-error Node.js maps process.stdout to console._stdout
  // eslint-disable-next-line no-console
  return console._stdout || process.stdout
}

export function escapeRegExp(s: string): string {
  // From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // $& means the whole matched string
}

export function wildcardPatternToRegExp(pattern: string): RegExp {
  const negated = pattern[0] === '!'

  if (negated) {
    pattern = pattern.slice(1)
  }

  let regexp = `${pattern.split('*').map(escapeRegExp).join('.*')}$`

  if (negated) {
    regexp = `(?!${regexp})`
  }

  return new RegExp(`^${regexp}`, 'i')
}

export function createIndexLocationsMap(source: string): Map<number, ModuleDefinitionLocation> {
  const map = new Map<number, ModuleDefinitionLocation>()
  let index = 0
  let line = 1
  let column = 1
  for (const char of source) {
    map.set(index++, { line, column })
    if (char === '\n' || char === '\r\n') {
      line++
      column = 0
    }
    else {
      column++
    }
  }
  return map
}

export function createLocationsIndexMap(source: string): Map<string, number> {
  const map = new Map<string, number>()
  let index = 0
  let line = 1
  let column = 1
  for (const char of source) {
    map.set(`${line}:${column}`, index++)
    if (char === '\n' || char === '\r\n') {
      line++
      column = 0
    }
    else {
      column++
    }
  }
  return map
}
