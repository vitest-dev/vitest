import { createDefer } from '@vitest/utils'
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
        fixture.deps = context.fixtures!.filter(({ prop }) => prop !== fixture.prop && usedProps.includes(prop))
    }
  })

  return context
}

const fixtureValueMaps = new Map<TestContext, Map<FixtureItem, any>>()
let cleanupFnArray = new Array<() => void | Promise<void>>()

export async function callFixtureCleanup() {
  for (const cleanup of cleanupFnArray.reverse())
    await cleanup()
  cleanupFnArray = []
}

export function withFixtures(fn: Function, testContext?: TestContext) {
  return (hookContext?: TestContext) => {
    const context: TestContext & { [key: string]: any } | undefined = hookContext || testContext

    if (!context)
      return fn({})

    const fixtures = getFixture(context)
    if (!fixtures?.length)
      return fn(context)

    const usedProps = getUsedProps(fn)
    if (!usedProps.length)
      return fn(context)

    if (!fixtureValueMaps.get(context))
      fixtureValueMaps.set(context, new Map<FixtureItem, any>())
    const fixtureValueMap: Map<FixtureItem, any> = fixtureValueMaps.get(context)!

    const usedFixtures = fixtures.filter(({ prop }) => usedProps.includes(prop))
    const pendingFixtures = resolveDeps(usedFixtures)

    if (!pendingFixtures.length)
      return fn(context)

    async function resolveFixtures() {
      for (const fixture of pendingFixtures) {
        // fixture could be already initialized during "before" hook
        if (fixtureValueMap.has(fixture))
          continue

        let resolvedValue: unknown
        if (fixture.isFn) {
          // wait for `use` call to extract fixture value
          const useFnArgPromise = createDefer()
          let isFixtureTeardown = false
          fixture.value(context, async (useFnArg: unknown) => {
            useFnArgPromise.resolve(useFnArg)
            // suspend fixture teardown until cleanup
            const teardownPromise = createDefer<void>()
            cleanupFnArray.push(teardownPromise.resolve)
            await teardownPromise
            isFixtureTeardown = true
          }).catch((e: unknown) => {
            // treat fixture setup error as test failure
            if (!isFixtureTeardown) {
              useFnArgPromise.reject(e)
              return
            }
            // re-throw if fixture teardown error
            throw e
          })
          resolvedValue = await useFnArgPromise
        }
        else {
          resolvedValue = fixture.value
        }
        context![fixture.prop] = resolvedValue
        fixtureValueMap.set(fixture, resolvedValue)
        cleanupFnArray.unshift(() => {
          fixtureValueMap.delete(fixture)
        })
      }
    }

    return resolveFixtures().then(() => fn(context))
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
      throw new Error(`Circular fixture dependency detected: ${fixture.prop} <- ${[...depSet].reverse().map(d => d.prop).join(' <- ')}`)

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
    throw new Error(`The first argument inside a fixture must use object destructuring pattern, e.g. ({ test } => {}). Instead, received "${first}".`)

  const _first = first.slice(1, -1).replace(/\s/g, '')
  const props = splitByComma(_first).map((prop) => {
    return prop.replace(/\:.*|\=.*/g, '')
  })

  const last = props.at(-1)
  if (last && last.startsWith('...'))
    throw new Error(`Rest parameters are not supported in fixtures, received "${last}".`)

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
