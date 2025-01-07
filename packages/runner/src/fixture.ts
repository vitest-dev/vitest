import type { FixtureOptions, TestContext } from './types/tasks'
import { createDefer, isObject } from '@vitest/utils'
import { getTestFixture } from './map'

export interface FixtureItem extends FixtureOptions {
  prop: string
  value: any
  /**
   * Indicates whether the fixture is a function
   */
  isFn: boolean
  /**
   * The dependencies(fixtures) of current fixture function.
   */
  deps?: FixtureItem[]
}

export function mergeContextFixtures<T extends { fixtures?: FixtureItem[] }>(
  fixtures: Record<string, any>,
  context: T,
  inject: (key: string) => unknown,
): T {
  const fixtureOptionKeys = ['auto', 'injected']
  const fixtureArray: FixtureItem[] = Object.entries(fixtures).map(
    ([prop, value]) => {
      const fixtureItem = { value } as FixtureItem

      if (
        Array.isArray(value)
        && value.length >= 2
        && isObject(value[1])
        && Object.keys(value[1]).some(key => fixtureOptionKeys.includes(key))
      ) {
        // fixture with options
        Object.assign(fixtureItem, value[1])
        const userValue = value[0]
        fixtureItem.value = fixtureItem.injected
          ? (inject(prop) ?? userValue)
          : userValue
      }

      fixtureItem.prop = prop
      fixtureItem.isFn = typeof fixtureItem.value === 'function'
      return fixtureItem
    },
  )

  if (Array.isArray(context.fixtures)) {
    context.fixtures = context.fixtures.concat(fixtureArray)
  }
  else {
    context.fixtures = fixtureArray
  }

  // Update dependencies of fixture functions
  fixtureArray.forEach((fixture) => {
    if (fixture.isFn) {
      const usedProps = getUsedProps(fixture.value)
      if (usedProps.length) {
        fixture.deps = context.fixtures!.filter(
          ({ prop }) => prop !== fixture.prop && usedProps.includes(prop),
        )
      }
    }
  })

  return context
}

const fixtureValueMaps = new Map<TestContext, Map<FixtureItem, any>>()
const cleanupFnArrayMap = new Map<
  TestContext,
  Array<() => void | Promise<void>>
>()

export async function callFixtureCleanup(context: TestContext): Promise<void> {
  const cleanupFnArray = cleanupFnArrayMap.get(context) ?? []
  for (const cleanup of cleanupFnArray.reverse()) {
    await cleanup()
  }
  cleanupFnArrayMap.delete(context)
}

export function withFixtures(fn: Function, testContext?: TestContext) {
  return (hookContext?: TestContext): any => {
    const context: (TestContext & { [key: string]: any }) | undefined
      = hookContext || testContext

    if (!context) {
      return fn({})
    }

    const fixtures = getTestFixture(context)
    if (!fixtures?.length) {
      return fn(context)
    }

    const usedProps = getUsedProps(fn)
    const hasAutoFixture = fixtures.some(({ auto }) => auto)
    if (!usedProps.length && !hasAutoFixture) {
      return fn(context)
    }

    if (!fixtureValueMaps.get(context)) {
      fixtureValueMaps.set(context, new Map<FixtureItem, any>())
    }
    const fixtureValueMap: Map<FixtureItem, any>
      = fixtureValueMaps.get(context)!

    if (!cleanupFnArrayMap.has(context)) {
      cleanupFnArrayMap.set(context, [])
    }
    const cleanupFnArray = cleanupFnArrayMap.get(context)!

    const usedFixtures = fixtures.filter(
      ({ prop, auto }) => auto || usedProps.includes(prop),
    )
    const pendingFixtures = resolveDeps(usedFixtures)

    if (!pendingFixtures.length) {
      return fn(context)
    }

    async function resolveFixtures() {
      for (const fixture of pendingFixtures) {
        // fixture could be already initialized during "before" hook
        if (fixtureValueMap.has(fixture)) {
          continue
        }

        const resolvedValue = fixture.isFn
          ? await resolveFixtureFunction(fixture.value, context, cleanupFnArray)
          : fixture.value
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

async function resolveFixtureFunction(
  fixtureFn: (
    context: unknown,
    useFn: (arg: unknown) => Promise<void>
  ) => Promise<void>,
  context: unknown,
  cleanupFnArray: (() => void | Promise<void>)[],
): Promise<unknown> {
  // wait for `use` call to extract fixture value
  const useFnArgPromise = createDefer()
  let isUseFnArgResolved = false

  const fixtureReturn = fixtureFn(context, async (useFnArg: unknown) => {
    // extract `use` argument
    isUseFnArgResolved = true
    useFnArgPromise.resolve(useFnArg)

    // suspend fixture teardown by holding off `useReturnPromise` resolution until cleanup
    const useReturnPromise = createDefer<void>()
    cleanupFnArray.push(async () => {
      // start teardown by resolving `use` Promise
      useReturnPromise.resolve()
      // wait for finishing teardown
      await fixtureReturn
    })
    await useReturnPromise
  }).catch((e: unknown) => {
    // treat fixture setup error as test failure
    if (!isUseFnArgResolved) {
      useFnArgPromise.reject(e)
      return
    }
    // otherwise re-throw to avoid silencing error during cleanup
    throw e
  })

  return useFnArgPromise
}

function resolveDeps(
  fixtures: FixtureItem[],
  depSet = new Set<FixtureItem>(),
  pendingFixtures: FixtureItem[] = [],
) {
  fixtures.forEach((fixture) => {
    if (pendingFixtures.includes(fixture)) {
      return
    }
    if (!fixture.isFn || !fixture.deps) {
      pendingFixtures.push(fixture)
      return
    }
    if (depSet.has(fixture)) {
      throw new Error(
        `Circular fixture dependency detected: ${fixture.prop} <- ${[...depSet]
          .reverse()
          .map(d => d.prop)
          .join(' <- ')}`,
      )
    }

    depSet.add(fixture)
    resolveDeps(fixture.deps, depSet, pendingFixtures)
    pendingFixtures.push(fixture)
    depSet.clear()
  })

  return pendingFixtures
}

function getUsedProps(fn: Function) {
  let fnString = fn.toString()
  // match lowered async function and strip it off
  // example code on esbuild-try https://esbuild.github.io/try/#YgAwLjI0LjAALS1zdXBwb3J0ZWQ6YXN5bmMtYXdhaXQ9ZmFsc2UAZQBlbnRyeS50cwBjb25zdCBvID0gewogIGYxOiBhc3luYyAoKSA9PiB7fSwKICBmMjogYXN5bmMgKGEpID0+IHt9LAogIGYzOiBhc3luYyAoYSwgYikgPT4ge30sCiAgZjQ6IGFzeW5jIGZ1bmN0aW9uKGEpIHt9LAogIGY1OiBhc3luYyBmdW5jdGlvbiBmZihhKSB7fSwKICBhc3luYyBmNihhKSB7fSwKCiAgZzE6IGFzeW5jICgpID0+IHt9LAogIGcyOiBhc3luYyAoeyBhIH0pID0+IHt9LAogIGczOiBhc3luYyAoeyBhIH0sIGIpID0+IHt9LAogIGc0OiBhc3luYyBmdW5jdGlvbiAoeyBhIH0pIHt9LAogIGc1OiBhc3luYyBmdW5jdGlvbiBnZyh7IGEgfSkge30sCiAgYXN5bmMgZzYoeyBhIH0pIHt9Cn0
  //   __async(this, null, function*
  //   __async(this, arguments, function*
  //   __async(this, [_0, _1], function*
  if (/__async\(this, (?:null|arguments|\[[_0-9, ]*\]), function\*/.test(fnString)) {
    fnString = fnString.split('__async(this,')[1]
  }
  const match = fnString.match(/[^(]*\(([^)]*)/)
  if (!match) {
    return []
  }

  const args = splitByComma(match[1])
  if (!args.length) {
    return []
  }

  let first = args[0]
  if ('__VITEST_FIXTURE_INDEX__' in fn) {
    first = args[(fn as any).__VITEST_FIXTURE_INDEX__]
    if (!first) {
      return []
    }
  }

  if (!(first.startsWith('{') && first.endsWith('}'))) {
    throw new Error(
      `The first argument inside a fixture must use object destructuring pattern, e.g. ({ test } => {}). Instead, received "${first}".`,
    )
  }

  const _first = first.slice(1, -1).replace(/\s/g, '')
  const props = splitByComma(_first).map((prop) => {
    return prop.replace(/:.*|=.*/g, '')
  })

  const last = props.at(-1)
  if (last && last.startsWith('...')) {
    throw new Error(
      `Rest parameters are not supported in fixtures, received "${last}".`,
    )
  }

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
      if (token) {
        result.push(token)
      }
      start = i + 1
    }
  }
  const lastToken = s.substring(start).trim()
  if (lastToken) {
    result.push(lastToken)
  }
  return result
}
