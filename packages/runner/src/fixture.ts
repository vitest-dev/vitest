import type { Fixtures, Test } from './types'

export interface FixtureItem {
  prop: string
  value: any
  hasDeps: boolean
  index: number
  end: number
}

export function mergeContextFixtures(fixtures: Fixtures<Record<string, any>>, context: Record<string, any> = {}) {
  const fixtureArray: FixtureItem[] = Object.entries(fixtures)
    .map(([prop, value], index, { length }) => {
      return {
        prop,
        value,
        index,
        end: length,
        hasDeps: typeof value === 'function' && value.length >= 2,
      }
    })

  if (Array.isArray(context.fixtures)) {
    fixtureArray.forEach((fixture) => {
      fixture.index += context.fixtures.length
      fixture.end += context.fixtures.length
    })

    context.fixtures = context.fixtures.concat(fixtureArray)
  }
  else {
    context.fixtures = fixtureArray
  }

  return context
}

export function withFixtures(fn: Function, fixtures: FixtureItem[], context: Test<Record<string, any>>['context']) {
  const props = getTestFnDepProps(fn, fixtures.map(({ prop }) => prop))

  if (props.length === 0)
    return () => fn(context)

  const filteredFixtures = fixtures.filter(({ prop }) => props.includes(prop))
  const pendingFixtures = resolveFixtureDeps(filteredFixtures, fixtures)

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

function resolveFixtureDeps(initialFixtures: FixtureItem[], fixtures: FixtureItem[]) {
  const pendingFixtures: FixtureItem[] = []

  function resolveDeps(fixture: FixtureItem, temp: Set<FixtureItem>) {
    if (!fixture.hasDeps) {
      pendingFixtures.push(fixture)
      return
    }

    // fixture function may depend on other fixtures
    const { index, value: fn, end } = fixture

    const potentialDeps = fixtures
      .slice(0, end)
      .filter(dep => dep.index !== index)

    const props = getFixtureFnDepProps(fn, potentialDeps.map(({ prop }) => prop))

    const deps = potentialDeps.filter(({ prop }) => props.includes(prop))
    deps.forEach((dep) => {
      if (!pendingFixtures.includes(dep)) {
        if (dep.hasDeps) {
          if (temp.has(dep))
            throw new Error('circular fixture dependency')
          temp.add(dep)
        }

        resolveDeps(dep, temp)
      }
    })

    pendingFixtures.push(fixture)
  }

  initialFixtures.forEach(fixture => resolveDeps(fixture, new Set([fixture])))

  return pendingFixtures
}

function getFixtureFnDepProps(fn: Function, allProps: string[]) {
  if (fn.length !== 2)
    throw new Error('fixture function should have two arguments, the fist one is the use function that should be called with fixture value, and the second is other fixtures that should be used with destructured expression. For example, `async ({ a, b }, use) => { await use(a + b) }`')

  const args = fn.toString().match(/[^(]*\(([^)]*)/)![1]
  const target = args.slice(args.indexOf(',') + 1).trim()

  return filterDestructuredProps(target, allProps, { enableRestParams: false, errorPrefix: `invalid fixture function\n\n${fn}\n\n` })
}

function getTestFnDepProps(fn: Function, allProps: string[]) {
  if (!fn.length)
    return []
  if (fn.length > 1)
    throw new Error('extended test function should have only one argument')

  const arg = fn.toString().match(/[^(]*\(([^)]*)/)![1]
  if (arg[0] !== '{' && arg.at(-1) !== '}')
    return allProps

  return filterDestructuredProps(arg, allProps, { enableRestParams: true, errorPrefix: `invalid extended test function\n\n${fn}\n\n` })
}

function filterDestructuredProps(arg: string, props: string[], options: { enableRestParams: boolean; errorPrefix?: string }) {
  if (!props.length)
    return []
  if (arg.length < 2 || arg[0] !== '{' || arg.at(-1) !== '}')
    throw new Error(`${options.errorPrefix}invalid destructured expression`)

  if (arg.indexOf('{') !== arg.lastIndexOf('{'))
    throw new Error(`${options.errorPrefix}nested destructured expression is not supported`)

  const usedProps = arg.slice(1, -1).split(',')
  const filteredProps = []

  for (const prop of usedProps) {
    if (!prop)
      continue

    let _prop = prop.trim()

    if (_prop.startsWith('...')) {
      // { a, b, ...rest }
      if (!options.enableRestParams)
        throw new Error(`${options.errorPrefix}rest param is not supported`)
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
