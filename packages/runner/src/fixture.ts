import type { FixtureFn, Suite, VitestRunner } from './types'
import type { File, FixtureOptions, TestContext } from './types/tasks'
import { createDefer, filterOutComments, isObject } from '@vitest/utils/helpers'
import { FixtureDependencyError } from './errors'
import { getTestFixtures } from './map'
import { getCurrentSuite } from './suite'

export interface TestFixtureItem extends FixtureOptions {
  name: string
  value: unknown
  scope: 'test' | 'file' | 'worker'
  deps: Set<string>
  // so it's possible to call base fixture inside ({ a: ({ a }, use) => {} })
  parent?: TestFixtureItem
}

export type UserFixtures = Record<string, unknown>
export type FixtureRegistrations = Map<string, TestFixtureItem>

export class TestFixtures {
  private _suiteContexts: WeakMap<Suite | { type: 'worker' }, /* context object */ Record<string, unknown>>
  private _overrides = new WeakMap<Suite, FixtureRegistrations>()
  private _registrations: FixtureRegistrations

  private static _definitions: TestFixtures[] = []
  private static _builtinFixtures: string[] = [
    'task',
    'signal',
    'onTestFailed',
    'onTestFinished',
    'skip',
    'annotate',
  ] satisfies (keyof TestContext)[]

  private static _fixtureOptionKeys: string[] = ['auto', 'injected', 'scope']
  private static _fixtureScopes: string[] = ['test', 'file', 'worker']
  private static _workerContextSuite = { type: 'worker' } as const

  static clearDefinitions(): void {
    TestFixtures._definitions.length = 0
  }

  static getWorkerContexts(): Record<string, any>[] {
    return TestFixtures._definitions.map(f => f.getWorkerContext())
  }

  static getFileContexts(file: File): Record<string, any>[] {
    return TestFixtures._definitions.map(f => f.getFileContext(file))
  }

  constructor(registrations?: FixtureRegistrations) {
    this._registrations = registrations ?? new Map()
    this._suiteContexts = new WeakMap()
    TestFixtures._definitions.push(this)
  }

  extend(runner: VitestRunner, userFixtures: UserFixtures): TestFixtures {
    const { suite } = getCurrentSuite()
    const isTopLevel = !suite || suite.file === suite
    const registrations = this.parseUserFixtures(runner, userFixtures, isTopLevel)
    return new TestFixtures(registrations)
  }

  get(suite: Suite): FixtureRegistrations {
    let currentSuite: Suite | undefined = suite
    while (currentSuite) {
      const overrides = this._overrides.get(currentSuite)
      // return the closest override
      if (overrides) {
        return overrides
      }
      if (currentSuite === currentSuite.file) {
        break
      }
      currentSuite = currentSuite.suite || currentSuite.file
    }
    return this._registrations
  }

  override(runner: VitestRunner, userFixtures: UserFixtures): void {
    const { suite: currentSuite, file } = getCurrentSuite()
    const suite = currentSuite || file
    const isTopLevel = !currentSuite || currentSuite.file === currentSuite
    // Create a copy of the closest parent's registrations to avoid modifying them
    // For chained calls, this.get(suite) returns this suite's overrides; for first call, returns parent's
    const suiteRegistrations = new Map(this.get(suite))
    const registrations = this.parseUserFixtures(runner, userFixtures, isTopLevel, suiteRegistrations)
    // If defined in top-level, just override all registrations
    // We don't support overriding suite-level fixtures anyway (it will throw an error)
    if (isTopLevel) {
      this._registrations = registrations
    }
    else {
      this._overrides.set(suite, registrations)
    }
  }

  getFileContext(file: File): Record<string, any> {
    if (!this._suiteContexts.has(file)) {
      this._suiteContexts.set(file, Object.create(null))
    }
    return this._suiteContexts.get(file)!
  }

  getWorkerContext(): Record<string, any> {
    if (!this._suiteContexts.has(TestFixtures._workerContextSuite)) {
      this._suiteContexts.set(TestFixtures._workerContextSuite, Object.create(null))
    }
    return this._suiteContexts.get(TestFixtures._workerContextSuite)!
  }

  private parseUserFixtures(
    runner: VitestRunner,
    userFixtures: UserFixtures,
    supportNonTest: boolean,
    registrations = new Map<string, TestFixtureItem>(this._registrations),
  ) {
    const errors: Error[] = []

    Object.entries(userFixtures).forEach(([name, fn]) => {
      let options: FixtureOptions | undefined
      let value: unknown | undefined
      let _options: FixtureOptions | undefined

      if (
        Array.isArray(fn)
        && fn.length >= 2
        && isObject(fn[1])
        && Object.keys(fn[1]).some(key => TestFixtures._fixtureOptionKeys.includes(key))
      ) {
        _options = fn[1] as FixtureOptions
        options = {
          auto: _options.auto ?? false,
          scope: _options.scope ?? 'test',
          injected: _options.injected ?? false,
        }
        value = options.injected
          ? (runner.injectValue?.(name) ?? fn[0])
          : fn[0]
      }
      else {
        value = fn
      }

      const parent = registrations.get(name)
      if (parent && options) {
        if (parent.scope !== options.scope) {
          errors.push(new FixtureDependencyError(`The "${name}" fixture was already registered with a "${options.scope}" scope.`))
        }
        if (parent.auto !== options.auto) {
          errors.push(new FixtureDependencyError(`The "${name}" fixture was already registered as { auto: ${options.auto} }.`))
        }
      }
      else if (parent) {
        options = {
          auto: parent.auto,
          scope: parent.scope,
          injected: parent.injected,
        }
      }
      else if (!options) {
        options = {
          auto: false,
          injected: false,
          scope: 'test',
        }
      }

      if (options.scope && !TestFixtures._fixtureScopes.includes(options.scope)) {
        errors.push(new FixtureDependencyError(`The "${name}" fixture has unknown scope "${options.scope}".`))
      }

      if (!supportNonTest && options.scope !== 'test') {
        errors.push(new FixtureDependencyError(`The "${name}" fixture cannot be defined with a ${options.scope} scope${!_options?.scope && parent?.scope ? ' (inherited from the base fixture)' : ''} inside the describe block. Define it at the top level of the file instead.`))
      }

      const deps = isFixtureFunction(value)
        ? getUsedProps(value)
        : new Set<string>()
      const item: TestFixtureItem = {
        name,
        value,
        auto: options.auto ?? false,
        injected: options.injected ?? false,
        scope: options.scope ?? 'test',
        deps,
        parent,
      }

      registrations.set(name, item)

      if (item.scope === 'worker' && (runner.pool === 'vmThreads' || runner.pool === 'vmForks')) {
        item.scope = 'file'
      }
    })

    // validate fixture dependency scopes
    for (const fixture of registrations.values()) {
      for (const depName of fixture.deps) {
        if (TestFixtures._builtinFixtures.includes(depName)) {
          continue
        }

        const dep = registrations.get(depName)
        if (!dep) {
          errors.push(new FixtureDependencyError(`The "${fixture.name}" fixture depends on unknown fixture "${depName}".`))
          continue
        }
        if (depName === fixture.name && !fixture.parent) {
          errors.push(new FixtureDependencyError(`The "${fixture.name}" fixture depends on itself, but does not have a base implementation.`))
          continue
        }

        if (TestFixtures._fixtureScopes.indexOf(fixture.scope) > TestFixtures._fixtureScopes.indexOf(dep.scope)) {
          errors.push(new FixtureDependencyError(`The ${fixture.scope} "${fixture.name}" fixture cannot depend on a ${dep.scope} fixture "${dep.name}".`))
          continue
        }
      }
    }

    if (errors.length === 1) {
      throw errors[0]
    }
    else if (errors.length > 1) {
      throw new AggregateError(errors, 'Cannot resolve user fixtures. See errors for more information.')
    }
    return registrations
  }
}

const cleanupFnArrayMap = new WeakMap<
  object,
  Array<() => void | Promise<void>>
>()

export async function callFixtureCleanup(context: object): Promise<void> {
  const cleanupFnArray = cleanupFnArrayMap.get(context) ?? []
  for (const cleanup of cleanupFnArray.reverse()) {
    await cleanup()
  }
  cleanupFnArrayMap.delete(context)
}

/**
 * Returns the current number of cleanup functions registered for the context.
 * This can be used as a checkpoint to later clean up only fixtures added after this point.
 */
export function getFixtureCleanupCount(context: object): number {
  return cleanupFnArrayMap.get(context)?.length ?? 0
}

/**
 * Cleans up only fixtures that were added after the given checkpoint index.
 * This is used by aroundEach to clean up fixtures created inside runTest()
 * while preserving fixtures that were created for aroundEach itself.
 */
export async function callFixtureCleanupFrom(context: object, fromIndex: number): Promise<void> {
  const cleanupFnArray = cleanupFnArrayMap.get(context)
  if (!cleanupFnArray || cleanupFnArray.length <= fromIndex) {
    return
  }
  // Get items added after the checkpoint
  const toCleanup = cleanupFnArray.slice(fromIndex)
  // Clean up in reverse order
  for (const cleanup of toCleanup.reverse()) {
    await cleanup()
  }
  // Remove cleaned up items from the array, keeping items before checkpoint
  cleanupFnArray.length = fromIndex
}

export interface WithFixturesOptions {
  /**
   * Whether this is a suite-level hook (beforeAll/afterAll/aroundAll).
   * Suite hooks can only access file/worker scoped fixtures and static values.
   */
  suiteHook?: 'beforeAll' | 'afterAll' | 'aroundAll'
  /**
   * The test context to use. If not provided, the hookContext passed to the
   * returned function will be used.
   */
  context?: Record<string, any>
  /**
   * Error with stack trace captured at hook registration time.
   * Used to provide better error messages with proper stack traces.
   */
  stackTraceError?: Error
  /**
   * Current fixtures from the context.
   */
  fixtures?: TestFixtures
}

const contextHasFixturesCache = new WeakMap<TestContext, WeakSet<TestFixtureItem>>()

export function withFixtures(fn: Function, options?: WithFixturesOptions) {
  const collector = getCurrentSuite()
  const suite = collector.suite || collector.file
  return async (hookContext?: TestContext): Promise<any> => {
    const context: (TestContext & { [key: string]: any }) | undefined = hookContext || options?.context as TestContext

    if (!context) {
      if (options?.suiteHook) {
        validateSuiteHook(fn, options.suiteHook, options.stackTraceError)
      }

      return fn({})
    }

    const fixtures = options?.fixtures || getTestFixtures(context)
    if (!fixtures) {
      return fn(context)
    }

    const registrations = fixtures.get(suite)
    if (!registrations.size) {
      return fn(context)
    }

    const usedFixtures: TestFixtureItem[] = []
    const usedProps = getUsedProps(fn)

    for (const fixture of registrations.values()) {
      if (fixture.auto || usedProps.has(fixture.name)) {
        usedFixtures.push(fixture)
      }
    }

    if (!usedFixtures.length) {
      return fn(context)
    }

    if (!cleanupFnArrayMap.has(context)) {
      cleanupFnArrayMap.set(context, [])
    }
    const cleanupFnArray = cleanupFnArrayMap.get(context)!

    const pendingFixtures = resolveDeps(usedFixtures, registrations)

    if (!pendingFixtures.length) {
      return fn(context)
    }

    // Check if suite-level hook is trying to access test-scoped fixtures
    // Suite hooks (beforeAll/afterAll/aroundAll) can only access file/worker scoped fixtures
    if (options?.suiteHook) {
      const testScopedFixtures = pendingFixtures.filter(f => f.scope === 'test')
      if (testScopedFixtures.length > 0) {
        const fixtureNames = testScopedFixtures.map(f => `"${f.name}"`).join(', ')
        const alternativeHook = {
          aroundAll: 'aroundEach',
          beforeAll: 'beforeEach',
          afterAll: 'afterEach',
        }
        const error = new FixtureDependencyError(
          `Test-scoped fixtures cannot be used inside ${options.suiteHook} hook. `
          + `The following fixtures are test-scoped: ${fixtureNames}. `
          + `Use { scope: 'file' } or { scope: 'worker' } fixtures instead, or move the logic to ${alternativeHook[options.suiteHook]} hook.`,
        )
        // Use stack trace from hook registration for better error location
        if (options.stackTraceError?.stack) {
          error.stack = error.message + options.stackTraceError.stack.replace(options.stackTraceError.message, '')
        }
        throw error
      }
    }

    if (!contextHasFixturesCache.has(context)) {
      contextHasFixturesCache.set(context, new WeakSet())
    }
    const cachedFixtures = contextHasFixturesCache.get(context)!

    for (const fixture of pendingFixtures) {
      if (fixture.scope === 'test') {
        // fixture could be already initialized during "before" hook
        // we can't check "fixture.name" in context because context may
        // access the parent fixture ({ a: ({ a }) => {} })
        if (cachedFixtures.has(fixture)) {
          continue
        }
        cachedFixtures.add(fixture)

        const resolvedValue = await resolveTestFixtureValue(
          fixture,
          context,
          cleanupFnArray,
        )
        context[fixture.name] = resolvedValue

        cleanupFnArray.push(() => {
          cachedFixtures.delete(fixture)
        })
      }
      else {
        const resolvedValue = await resolveScopeFixtureValue(
          fixtures,
          suite,
          fixture,
        )
        context[fixture.name] = resolvedValue
      }
    }

    return fn(context)
  }
}

function isFixtureFunction(value: unknown): value is FixtureFn<any, any, any> {
  return typeof value === 'function'
}

function resolveTestFixtureValue(
  fixture: TestFixtureItem,
  context: TestContext & { [key: string]: any },
  cleanupFnArray: (() => void | Promise<void>)[],
) {
  if (!isFixtureFunction(fixture.value)) {
    return fixture.value
  }

  return resolveFixtureFunction(
    fixture.value,
    context,
    cleanupFnArray,
  )
}

const scopedFixturePromiseCache = new WeakMap<TestFixtureItem, Promise<unknown>>()

async function resolveScopeFixtureValue(
  fixtures: TestFixtures,
  suite: Suite,
  fixture: TestFixtureItem,
) {
  const workerContext = fixtures.getWorkerContext()
  const fileContext = fixtures.getFileContext(suite.file)
  const fixtureContext = fixture.scope === 'worker' ? workerContext : fileContext

  if (!isFixtureFunction(fixture.value)) {
    fixtureContext[fixture.name] = fixture.value
    return fixture.value
  }

  if (fixture.name in fixtureContext) {
    return fixtureContext[fixture.name]
  }

  if (scopedFixturePromiseCache.has(fixture)) {
    return scopedFixturePromiseCache.get(fixture)!
  }

  if (!cleanupFnArrayMap.has(fixtureContext)) {
    cleanupFnArrayMap.set(fixtureContext, [])
  }
  const cleanupFnFileArray = cleanupFnArrayMap.get(fixtureContext)!

  const promise = resolveFixtureFunction(
    fixture.value,
    fixture.scope === 'file' ? { ...workerContext, ...fileContext } : fixtureContext,
    cleanupFnFileArray,
  ).then((value) => {
    fixtureContext[fixture.name] = value
    scopedFixturePromiseCache.delete(fixture)
    return value
  })
  scopedFixturePromiseCache.set(fixture, promise)
  return promise
}

async function resolveFixtureFunction(
  fixtureFn: (
    context: unknown,
    useFn: (arg: unknown) => Promise<void>,
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
  usedFixtures: TestFixtureItem[],
  registrations: FixtureRegistrations,
  depSet = new Set<TestFixtureItem>(),
  pendingFixtures: TestFixtureItem[] = [],
) {
  usedFixtures.forEach((fixture) => {
    if (pendingFixtures.includes(fixture)) {
      return
    }
    if (!isFixtureFunction(fixture.value) || !fixture.deps) {
      pendingFixtures.push(fixture)
      return
    }
    if (depSet.has(fixture)) {
      if (fixture.parent) {
        fixture = fixture.parent
      }
      else {
        throw new Error(
          `Circular fixture dependency detected: ${fixture.name} <- ${[...depSet]
            .reverse()
            .map(d => d.name)
            .join(' <- ')}`,
        )
      }
    }

    depSet.add(fixture)
    resolveDeps(
      [...fixture.deps].map(n => n === fixture.name ? fixture.parent : registrations.get(n)).filter(n => !!n),
      registrations,
      depSet,
      pendingFixtures,
    )
    pendingFixtures.push(fixture)
    depSet.clear()
  })

  return pendingFixtures
}

function validateSuiteHook(fn: Function, hook: string, error: Error | undefined) {
  const usedProps = getUsedProps(fn)
  if (usedProps.size) {
    console.warn(`The ${hook} hook uses fixtures "${[...usedProps].join('", "')}", but has no access to context. Did you forget to call it as "test.${hook}()" instead of "${hook}()"? This will throw an error in a future major. See https://vitest.dev/guide/test-context#suite-level-hooks`)
    if (error) {
      const processor = (globalThis as any).__vitest_worker__?.onFilterStackTrace || ((s: string) => s || '')
      const stack = processor(error.stack || '')
      console.warn(stack)
    }
  }
}

const kPropsSymbol = Symbol('$vitest:fixture-props')

interface FixturePropsOptions {
  index?: number
  original?: Function
}

export function configureProps(fn: Function, options: FixturePropsOptions): void {
  Object.defineProperty(fn, kPropsSymbol, {
    value: options,
    enumerable: false,
  })
}

function getUsedProps(fn: Function): Set<string> {
  const {
    index: fixturesIndex = 0,
    original: implementation = fn,
  } = kPropsSymbol in fn ? fn[kPropsSymbol] as FixturePropsOptions : {}
  let fnString = filterOutComments(implementation.toString())

  // match lowered async function and strip it off
  // example code on esbuild-try https://esbuild.github.io/try/#YgAwLjI0LjAALS1zdXBwb3J0ZWQ6YXN5bmMtYXdhaXQ9ZmFsc2UAZQBlbnRyeS50cwBjb25zdCBvID0gewogIGYxOiBhc3luYyAoKSA9PiB7fSwKICBmMjogYXN5bmMgKGEpID0+IHt9LAogIGYzOiBhc3luYyAoYSwgYikgPT4ge30sCiAgZjQ6IGFzeW5jIGZ1bmN0aW9uKGEpIHt9LAogIGY1OiBhc3luYyBmdW5jdGlvbiBmZihhKSB7fSwKICBhc3luYyBmNihhKSB7fSwKCiAgZzE6IGFzeW5jICgpID0+IHt9LAogIGcyOiBhc3luYyAoeyBhIH0pID0+IHt9LAogIGczOiBhc3luYyAoeyBhIH0sIGIpID0+IHt9LAogIGc0OiBhc3luYyBmdW5jdGlvbiAoeyBhIH0pIHt9LAogIGc1OiBhc3luYyBmdW5jdGlvbiBnZyh7IGEgfSkge30sCiAgYXN5bmMgZzYoeyBhIH0pIHt9LAoKICBoMTogYXN5bmMgKCkgPT4ge30sCiAgLy8gY29tbWVudCBiZXR3ZWVuCiAgaDI6IGFzeW5jIChhKSA9PiB7fSwKfQ
  //   __async(this, null, function*
  //   __async(this, arguments, function*
  //   __async(this, [_0, _1], function*
  if (/__async\((?:this|null), (?:null|arguments|\[[_0-9, ]*\]), function\*/.test(fnString)) {
    fnString = fnString.split(/__async\((?:this|null),/)[1]
  }
  const match = fnString.match(/[^(]*\(([^)]*)/)
  if (!match) {
    return new Set()
  }

  const args = splitByComma(match[1])
  if (!args.length) {
    return new Set()
  }

  const fixturesArgument = args[fixturesIndex]

  if (!fixturesArgument) {
    return new Set()
  }

  if (!(fixturesArgument[0] === '{' && fixturesArgument.endsWith('}'))) {
    throw new Error(
      `The first argument inside a fixture must use object destructuring pattern, e.g. ({ test } => {}). Instead, received "${fixturesArgument}".`,
    )
  }

  const _first = fixturesArgument.slice(1, -1).replace(/\s/g, '')
  const props = splitByComma(_first).map((prop) => {
    return prop.replace(/:.*|=.*/g, '')
  })

  const last = props.at(-1)
  if (last && last.startsWith('...')) {
    throw new Error(
      `Rest parameters are not supported in fixtures, received "${last}".`,
    )
  }

  return new Set(props)
}

function splitByComma(s: string) {
  const result = []
  const stack = []
  let start = 0
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{' || s[i] === '[') {
      stack.push(s[i] === '{' ? '}' : ']')
    }
    else if (s[i] === stack.at(-1)) {
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
