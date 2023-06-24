import type { TestContext } from './types'

export interface FixtureItem {
  prop: string
  value: any
  /**
   * Indicates whether the fixture is a function
   */
  isFn: boolean
  /**
   * Fixture function may depend on other fixtures,
   * e.g. `async (use, { a, b }) => await use(a + b)`.
   * This array contains the available dependencies of the fixture function.
   */
  availableDeps: FixtureItem[]
}

export function mergeContextFixtures(fixtures: Record<string, any>, context: { fixtures?: FixtureItem[] } = {}) {
  const fixtureArray: FixtureItem[] = Object.entries(fixtures)
    .map(([prop, value]) => {
      const isFn = typeof value === 'function'
      if (isFn)
        validateFixtureFn(value)

      return {
        prop,
        value,
        isFn,
        availableDeps: [],
      }
    })

  if (Array.isArray(context.fixtures))
    context.fixtures = context.fixtures.concat(fixtureArray)
  else
    context.fixtures = fixtureArray

  fixtureArray.forEach((fixture) => {
    if (fixture.isFn)
      fixture.availableDeps = context.fixtures!.filter(item => item !== fixture)
  })

  return context
}

export function withFixtures(fn: Function, fixtures: FixtureItem[], context: TestContext & Record<string, any>) {
  validateTestFn(fn)
  const props = getTestFnDepProps(fn, fixtures.map(({ prop }) => prop))

  if (props.length === 0)
    return () => fn(context)

  const filteredFixtures = fixtures.filter(({ prop }) => props.includes(prop))
  const pendingFixtures = resolveFixtureDeps(filteredFixtures)

  let cursor = 0

  async function use(fixtureValue: any) {
    const { prop } = pendingFixtures[cursor++]
    context[prop] = fixtureValue

    if (cursor < pendingFixtures.length)
      await next()
    else await fn(context)
  }

  async function next() {
    const { value } = pendingFixtures[cursor]
    typeof value === 'function' ? await value(use, context) : await use(value)
  }

  return () => next()
}

function resolveFixtureDeps(fixtures: FixtureItem[]) {
  const pendingFixtures: FixtureItem[] = []

  function resolveDeps(fixture: FixtureItem, depSet: Set<FixtureItem>) {
    if (!fixture.isFn) {
      pendingFixtures.push(fixture)
      return
    }

    const { value: fn, availableDeps } = fixture
    const props = getFixtureFnDepProps(fn, availableDeps.map(({ prop }) => prop))

    const deps = availableDeps.filter(({ prop }) => props.includes(prop))
    deps.forEach((dep) => {
      if (!pendingFixtures.includes(dep)) {
        if (dep.isFn) {
          if (depSet.has(dep))
            throw new Error('circular fixture dependency')
          depSet.add(dep)
        }

        resolveDeps(dep, depSet)
      }
    })

    pendingFixtures.push(fixture)
  }

  fixtures.forEach(fixture => resolveDeps(fixture, new Set([fixture])))

  return pendingFixtures
}

function getFixtureFnDepProps(fn: Function, props: string[]) {
  if (fn.length === 1)
    return []
  const args = getFnArgumentsStr(fn)
  const secondArg = args.slice(args.indexOf(',') + 1).trim()
  return filterPropsByObjectDestructuring(secondArg, props)
}

function getTestFnDepProps(fn: Function, props: string[]) {
  if (!fn.length)
    return []

  const arg = getFnArgumentsStr(fn).trim()
  if (!arg.startsWith('{'))
    return props

  return filterPropsByObjectDestructuring(arg, props)
}

function filterPropsByObjectDestructuring(argStr: string, props: string[]) {
  if (!argStr.startsWith('{') || !argStr.endsWith('}'))
    throw new Error('Invalid object destructuring pattern')

  const usedProps = argStr.slice(1, -1).split(',')
  const filteredProps = []

  for (const prop of usedProps) {
    if (!prop)
      continue

    let _prop = prop.trim()

    if (_prop.startsWith('...')) {
      // { a, b, ...rest }
      return props
    }

    const colonIndex = _prop.indexOf(':')
    if (colonIndex > 0)
      _prop = _prop.slice(0, colonIndex).trim()

    if (props.includes(_prop))
      filteredProps.push(_prop)
  }

  return filteredProps
}

function getFnArgumentsStr(fn: Function) {
  if (!fn.length)
    return ''
  return fn.toString().match(/[^(]*\(([^)]*)/)![1]
}

function validateFixtureFn(fn: Function) {
  if (fn.length < 1 || fn.length > 2)
    throw new Error('invalid fixture function, should follow below rules:\n- have at least one argument, at most two arguments\n- the first argument is the "use" function, which must be invoked with fixture value\n- the second argument should use the object destructuring pattern to access other fixtures\n\nFor instance,\nasync (use) => { await use(0) }\nasync (use, { a, b }) => { await use(a + b) }')

  if (fn.length === 2) {
    const args = getFnArgumentsStr(fn)
    if (args.includes('...'))
      throw new Error('rest param is not supported')

    const second = args.slice(args.indexOf(',') + 1).trim()

    if (second.length < 2 || !second.startsWith('{') || !second.endsWith('}'))
      throw new Error('the second argument should use the object destructuring pattern')

    if (second.indexOf('{') !== second.lastIndexOf('{'))
      throw new Error('nested object destructuring pattern is not supported')
  }
}

function validateTestFn(fn: Function) {
  if (fn.length > 1)
    throw new Error('extended test function should have only one argument')
}
