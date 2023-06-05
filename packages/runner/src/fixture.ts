import type { Fixtures, Test } from './types'

export function withFixtures(fn: Function, fixtures: Fixtures, context: Test<Record<string, any>>['context']) {
  const _fixtures = parseFixtures(fixtures)

  if (_fixtures.length === 0)
    return () => fn(context)

  let cursor = 0

  async function use(fixtureValue: any) {
    const fixtureName = _fixtures[cursor++].name
    context[fixtureName] = fixtureValue

    if (cursor < _fixtures.length)
      await next()
    else await fn(context)
  }

  async function next() {
    const v = _fixtures[cursor].value
    typeof v === 'function'
      ? await v(use)
      : await use(v)
  }

  return () => next()
}

function parseFixtures(fixtures: Fixtures) {
  return Object.entries(fixtures).map(([name, value]) => ({ name, value }))
}
