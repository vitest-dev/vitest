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
      const { args, restParams } = parseFnArgs(fixture.value)

      if (args.length <= 1 && !restParams) {
        // async () => {}
        // async (use) => {}
        return
      }

      // exclude self
      let deps = context.fixtures!.filter(item => item.index !== fixture.index)
      if (args.length >= 2 && isObjectDestructuring(args[1])) {
        const { props, restParams } = getDestructuredProps(args[1])
        if (!restParams) {
          // async (use, { a, b }) => {}
          deps = deps.filter(item => props.includes(item.prop))
        }
      }

      // async (...rest) => {}
      // async (use, ...rest) => {}
      // async (use, context) => {}
      // async (use, { a, b, ...rest }) => {}
      fixture.deps = deps
    }
  })

  return context
}

export function withFixtures(fn: Function, fixtures: FixtureItem[], context: TestContext & Record<string, any>) {
  const { args, restParams } = parseFnArgs(fn)
  if ((!args.length && !restParams)) {
    // test('', () => {})
    return () => fn(context)
  }

  // test('', (context) => {})
  // test('', ({ a, b, ...rest }) => {})
  let filteredFixtures = fixtures

  if (isObjectDestructuring(args[0])) {
    const { props, restParams } = getDestructuredProps(args[0])
    if (!props.length && !restParams) {
      // test('', ({ }) => {})
      return () => fn(context)
    }
    if (!restParams && props.length) {
      // test('', ({ a, b }) => {})
      filteredFixtures = fixtures.filter(item => props.includes(item.prop))
    }
  }

  const pendingFixtures = resolveDeps(filteredFixtures)
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

/**
 * To smartly initialize fixtures based on usage, we need to know whether a fixture will be consumed in test function(or in another fixture function) or not, so this function was implemented to get the arguments of both the test function and the fixture function.
 *
 * e.g. `async (use, { a, b }, ...rest) => {}` => `{ args: ['use', '{a,b}'], restParams: true }`
 *
 */
function parseFnArgs(fn: Function) {
  let str = fn.toString()
  str = str.slice(str.indexOf('(') + 1)
  str = str.replace(/\s|\'.*\'|\".*\"|\`.*\`|\(.*\)/g, '')
  const parentheses = ['(']
  const curlyBrackets = []
  const brackets = []
  const args: string[] = []
  let arg = ''
  let i = 0

  function addArg(a: string) {
    args.push(a)
    arg = ''
  }

  while (i < str.length) {
    const s = str[i++]
    switch (s) {
      case '(':
        parentheses.push(s)
        break
      case ')':
        parentheses.pop()
        if (!parentheses.length) {
          addArg(arg)
          break
        }
        break
      case '{':
        curlyBrackets.push(s)
        break
      case '}':
        curlyBrackets.pop()
        break
      case '[':
        brackets.push(s)
        break
      case ']':
        brackets.pop()
        break
      case ',':
        if (!curlyBrackets.length && !brackets.length) {
          addArg(arg)
          continue
        }
        break
    }
    arg += s
  }
  const restParams = args.length > 0 && args.at(-1)?.startsWith('...')
  const _args = restParams ? args.slice(0, -1) : args
  return { args: _args.filter(Boolean), restParams }
}

function isObjectDestructuring(str: string) {
  return str.startsWith('{') && str.endsWith('}')
}

/**
 * `'{ a, b: { c }, ...rest }'` => `{ props: ['a', 'b'], restParams: true }`
 */
function getDestructuredProps(str: string) {
  str = str.replace(/\s/g, '')
  const curlyBrackets = ['{']
  const props: string[] = []
  let prop = ''
  let i = 1

  function pushProp(p: string) {
    p = p.trim()
    p.length > 0 && props.push(p)
    prop = ''
  }

  while (i < str.length) {
    const s = str[i++]
    if (s === '{')
      curlyBrackets.push(s)
    if (s === '}') {
      if (curlyBrackets.length === 1) {
        pushProp(prop)
        break
      }
      else { curlyBrackets.pop() }
    }
    if (s === ',' && curlyBrackets.length === 1) {
      pushProp(prop)
      continue
    }
    prop += s
  }

  const restParams = props.length > 0 && props.at(-1)?.startsWith('...')
  const _props = restParams ? props.slice(0, -1) : props
  return {
    props: _props.map((p) => {
      if (/\:|\=/.test(p))
        return p.replace(/\:.*|\=.*/g, '')
      return p
    }),
    restParams,
  }
}
