import type { Fixtures, Test } from './types'

export function withFixtures(fn: Function, fixtures: Fixtures<Record<string, any>>, context: Test<Record<string, any>>['context']) {
  const props = getUsedFixtureProps(fn, Object.keys(fixtures))

  if (props.length === 0)
    return () => fn(context)

  let cursor = 0

  async function use(fixtureValue: any) {
    context[props[cursor++]] = fixtureValue

    if (cursor < props.length)
      await next()
    else await fn(context)
  }

  async function next() {
    const fixtureValue = fixtures[props[cursor]]
    typeof fixtureValue === 'function'
      ? await fixtureValue(use)
      : await use(fixtureValue)
  }

  return () => next()
}

function getUsedFixtureProps(fn: Function, fixtureProps: string[]) {
  if (!fixtureProps.length || !fn.length)
    return []

  const paramsStr = fn.toString().match(/[^(]*\(([^)]*)/)![1]

  if (paramsStr[0] === '{' && paramsStr.at(-1) === '}') {
    // ({...}) => {}
    const props = paramsStr.slice(1, -1).split(',')
    const filteredProps = []

    for (const prop of props) {
      if (!prop)
        continue

      let _prop = prop.trim()

      if (_prop.startsWith('...')) {
        // ({ a, b, ...rest }) => {}
        return fixtureProps
      }

      const colonIndex = _prop.indexOf(':')
      if (colonIndex > 0)
        _prop = _prop.slice(0, colonIndex).trim()

      if (fixtureProps.includes(_prop))
        filteredProps.push(_prop)
    }

    // ({}) => {}
    // ({ a, b, c}) => {}
    return filteredProps
  }

  // (ctx) => {}
  return fixtureProps
}
