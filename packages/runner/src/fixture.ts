import { getFixture } from './map'
import type { TestContext } from './types'

export interface FixtureItem {
  prop: string
  value: any
  index: number
  /**
   * Indicates whether the fixture is a function
   */
  isFn: boolean
  /**
   * The dependencies(fixtures) of current fixture function.
   */
  deps?: FixtureItem[]
}

export function mergeContextFixtures(fixtures: Record<string, any>, context: { fixtures?: FixtureItem[] } = {}) {
  const fixtureArray: FixtureItem[] = Object.entries(fixtures)
    .map(([prop, value], index) => {
      const isFn = typeof value === 'function'
      return {
        prop,
        value,
        index,
        isFn,
      }
    })

  if (Array.isArray(context.fixtures))
    context.fixtures = context.fixtures.concat(fixtureArray)
  else
    context.fixtures = fixtureArray

  // Update dependencies of fixture functions
  fixtureArray.forEach((fixture) => {
    if (fixture.isFn) {
      const usedProps = getUsedProps(fixture.value)
      if (usedProps.length)
        fixture.deps = context.fixtures!.filter(({ index, prop }) => index !== fixture.index && usedProps.includes(prop))
    }
  })

  return context
}

export function withFixtures(fn: Function, testContext?: TestContext & { [key: string]: any }) {
  return (hookContext?: TestContext & { [key: string]: any }) => {
    const context = hookContext || testContext

    if (!context)
      return fn({})

    const fixtures = getFixture(context)
    if (!fixtures?.length)
      return fn(context)

    const usedProps = getUsedProps(fn)
    if (!usedProps.length)
      return fn(context)

    const usedFixtures = fixtures.filter(({ prop }) => usedProps.includes(prop))
    const pendingFixtures = resolveDeps(usedFixtures)
    let cursor = 0

    async function use(fixtureValue: any) {
      const { prop } = pendingFixtures[cursor++]
      context![prop] = fixtureValue

      if (cursor < pendingFixtures.length)
        await next()
      else await fn(context)
    }

    async function next() {
      const { value } = pendingFixtures[cursor]
      typeof value === 'function' ? await value(context, use) : await use(value)
    }

    return next()
  }
}

function resolveDeps(fixtures: FixtureItem[], depSet = new Set<FixtureItem>(), pendingFixtures: FixtureItem[] = []) {
  fixtures.forEach((fixture) => {
    if (pendingFixtures.includes(fixture))
      return
    if (!fixture.isFn || !fixture.deps) {
      pendingFixtures.push(fixture)
      return
    }
    if (depSet.has(fixture))
      throw new Error('circular fixture dependency')

    depSet.add(fixture)
    resolveDeps(fixture.deps, depSet, pendingFixtures)
    pendingFixtures.push(fixture)
    depSet.clear()
  })

  return pendingFixtures
}

function getUsedProps(fn: Function) {
  const match = fn.toString().match(/[^(]*\(([^)]*)/)
  if (!match)
    return []

  const args = splitByComma(match[1])
  if (!args.length)
    return []

  const first = args[0]
  if (!(first.startsWith('{') && first.endsWith('}')))
    throw new Error('the first argument must use object destructuring pattern')

  const _first = first.slice(1, -1).replace(/\s/g, '')
  const props = splitByComma(_first).map((prop) => {
    return prop.replace(/\:.*|\=.*/g, '')
  })

  const last = props.at(-1)
  if (last && last.startsWith('...'))
    throw new Error('Rest parameters are not supported')

  return props
}

function splitByComma(s: string) {
  const result = []
  const stack = []
  let start = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') {
      stack.push(s[i] === '{' ? '}' : ']')
    }
    else if (s[i] === stack[stack.length - 1]) {
      stack.pop()
    }
    else if (!stack.length && s[i] === ',') {
      const token = s.substring(start, i).trim()
      if (token)
        result.push(token)
      start = i + 1
    }
  }
  const lastToken = s.substring(start).trim()
  if (lastToken)
    result.push(lastToken)
  return result
}
