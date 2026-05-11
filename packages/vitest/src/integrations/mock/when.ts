import type { Mock, Procedure } from '@vitest/spy'
import type { Disposable } from 'vitest/optional-runtime-types.js'
import { equals, getCustomEqualityTesters, iterableEquality } from '@vitest/expect'
import { isMockFunction } from '@vitest/spy'
import { stringify } from '@vitest/utils/display'
import { noop } from '@vitest/utils/helpers'

type BehaviorType = 'return' | 'throw' | 'resolve' | 'reject'

const whenSymbol = Symbol.for('$$vitest:when')

/**
 * Returns `true` if the given value is a {@linkcode When} chain created by {@linkcode when|vi.when}.
 *
 * @param input - The value to check.
 * @returns `true` if `input` is a {@linkcode When} instance, `false` otherwise.
 *
 * @example
 * const spy = vi.fn()
 * const w = vi.when(spy).calledWith(1).thenReturn(0)
 *
 * expect(isWhenChain(w)).toBe(true)
 * expect(isWhenChain(spy)).toBe(false)
 */
export function isWhenChain(input: object): input is When<Procedure> {
  return Reflect.has(input, whenSymbol)
}

interface Behavior<Arguments extends unknown[], Value> {
  arguments: Arguments
  actions: {
    type: BehaviorType
    value: Value | unknown
    times: number
    remaining: number
    called: boolean
  }[]
}

interface BehaviorOptions {
  /**
   * How many times this behavior should apply before being exhausted.
   *
   * By default it applies indefinitely.
   *
   * @default Number.POSITIVE_INFINITY
   */
  times?: number | undefined
}

type OnceBehaviorOptions = Omit<BehaviorOptions, 'times'>

/**
 * Fluent interface returned by {@linkcode When.calledWith} for defining behaviors on a specific set of arguments.
 *
 * Each `then*` method appends an action and returns the same instance, allowing multiple behaviors to be chained for the same argument set.
 *
 * @example
 * vi.when(spy)
 *   .calledWith('darkMode')
 *   .thenReturn(true)
 *   .thenReturnOnce(false)
 */
type CalledWithInstance<ReturnType, Fn extends Procedure> = When<Fn> & {
  /**
   * Schedules a synchronous return value for when the spy is called with the registered arguments.
   *
   * @param value - The value to return.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenReturn: (value: ReturnType, options?: BehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>

  /**
   * Schedules a resolved `Promise` return value for when the spy is called with the registered arguments.
   *
   * @param value - The value to resolve with.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenResolve: (value: ReturnType, options?: BehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>

  /**
   * Schedules a synchronous return value for a single call with the registered arguments, then removes the behavior.
   *
   * @param value - The value to return.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenReturnOnce: (value: ReturnType, options?: OnceBehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>

  /**
   * Schedules a resolved `Promise` return value for a single call with the registered arguments, then removes the behavior.
   *
   * @param value - The value to resolve with.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenResolveOnce: (value: ReturnType, options?: OnceBehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>

  /**
   * Schedules a thrown error for when the spy is called with the registered arguments.
   *
   * @param value - The value to throw.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenThrow: (value: unknown, options?: BehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>

  /**
   * Schedules a rejected `Promise` for when the spy is called with the registered arguments.
   *
   * @param value - The value to reject with.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenReject: (value: unknown, options?: BehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>

  /**
   * Schedules a thrown error for a single call with the registered arguments, then removes the behavior.
   *
   * @param value - The value to throw.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenThrowOnce: (value: unknown, options?: OnceBehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>

  /**
   * Schedules a rejected `Promise` for a single call with the registered arguments, then removes the behavior.
   *
   * @param value - The value to reject with.
   * @param options - Optional behavior configuration.
   * @returns The same {@linkcode when|vi.when} instance for chaining.
   */
  thenRejectOnce: (value: unknown, options?: OnceBehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>
}

/**
 * A handle returned by {@linkcode when|vi.when} that lets define per-argument behaviors on a spy and check whether all defined behaviors have been consumed.
 *
 * Implements `Symbol.dispose` so it can be used with the `using` keyword. When the block exits the spy's original implementation is automatically restored.
 *
 * @example
 * using w = vi.when(spy)
 *   .calledWith('hello')
 *   .thenReturn('HELLO')
 */
interface When<Fn extends Procedure> extends Disposable {
  /**
   * Defines behavior for a specific set of arguments.
   *
   * Multiple behaviors can be stacked for the same arguments. They are matched last-registered first (LIFO stack, last in first out), so earlier entries act as fallbacks once later ones are exhausted.
   *
   * @param args - The arguments to match against.
   * @returns A {@linkcode CalledWithInstance} for chaining `then*` actions.
   *
   * @example
   * vi.when(spy)
   *   .calledWith(expect.any(Number))
   *   .thenReturn(0)
   *
   * @example
   * // Stack behaviors: first call returns `false`, subsequent calls return `true`
   * vi.when(spy)
   *   .calledWith('darkMode')
   *   .thenReturn(true)
   *   .thenReturnOnce(false)
   */
  'calledWith': (...args: Parameters<Fn>) => CalledWithInstance<ReturnType<Fn>, Fn>
  /**
   * Returns a diagnostic snapshot of the current state of all registered behaviors.
   *
   * Useful for producing human-readable failure messages in custom assertions or test helpers.
   *
   * @returns An object with:
   * - `isExhausted` — `true` if every registered behavior has been consumed, `false` otherwise or if no behaviors have been registered.
   * - `pendingBehaviors` — A formatted multi-line string describing behaviors that have not yet been fully consumed.
   *
   * @internal
   *
   * @example
   * const spy = vi.fn()
   * const w = vi.when(spy)
   *   .calledWith(1).thenReturnOnce(0)
   *   .calledWith(2).thenReturn(42)
   *
   * spy(1)
   *
   * const { isExhausted, pendingBehaviors } = w.collectPendingBehaviors()
   *
   * expect(isExhausted).toBe(false)
   *
   * console.log(pendingBehaviors)
   * // calledWith(2)
   * //   ✗ thenReturn(42)    never called
   */
  '~getDiagnostics': () => {
    isExhausted: boolean
    pendingBehaviors: string
  }
}

/**
 * Options for {@linkcode when|vi.when}.
 */
interface WhenOptions<Fn extends Procedure = Procedure> {
  /**
   * Controls what happens when the spy is called with arguments that have no matching `calledWith` behavior.
   *
   * Valid configurations are:
   * - `'passthrough'` — delegates to the spy's original implementation (default)
   * - `'throw'` — throws an error
   * - a function — called with the unmatched arguments; its return value is used
   *
   * @default
   * 'passthrough'
   *
   * @example
   * vi.when(spy, { onUnmatched: 'throw' })
   *   .calledWith(1)
   *   .thenReturn({ id: 1, name: 'Alice' })
   *
   * expect(spy(1)).toEqual({ id: 1, name: 'Alice' })
   * expect(() => spy(2)).toThrow()
   */
  onUnmatched?: 'throw' | 'passthrough' | Fn | undefined
}

/**
 * Defines conditional behaviors on a Vitest spy based on the arguments it is called with.
 *
 * Behaviors are matched using deep equality, last-registered first within each argument set.
 *
 * It automatically restores the spy's original implementation when the enclosing block exits if used with the `using` keyword.
 *
 * @param spy - A Vitest mock function to attach behaviors to.
 * @param options - Optional configuration.
 * @returns A {@linkcode When} instance for registering behaviors.
 *
 * @throws {TypeError} If `spy` is not a Vitest mock function.
 *
 * @experimental
 * @since 5.0.0
 * @see {@link https://vitest.dev/api/vi#vi-when}
 *
 * @example
 * // Basic usage
 * const spy = vi.fn(() => Number.NEGATIVE_INFINITY)
 * vi.when(spy).calledWith(1).thenReturn(0)
 *
 * expect(spy(1)).toBe(0)
 * expect(spy(2)).toBe(Number.NEGATIVE_INFINITY) // falls through to original implementation
 *
 * @example
 * // Async
 * const spy = vi.fn()
 * vi.when(spy).calledWith('user').thenResolve({ id: 1 })
 *
 * await expect(spy('user')).resolves.toEqual({ id: 1 })
 *
 * @example
 * // Scoped with `using`
 * const spy = vi.fn()
 *
 * {
 *   using w = vi.when(spy)
 *     .calledWith('darkMode')
 *     .thenReturn(true)
 *
 *   expect(spy('darkMode')).toBe(true)
 * }
 *
 * // spy's original implementation is restored here
 * expect(spy('darkMode')).toBe(undefined)
 *
 * @example
 * // Throw on unmatched calls
 * vi.when(spy, { onUnmatched: 'throw' })
 *   .calledWith(1)
 *   .thenReturn({ id: 1, name: 'Alice' })
 *
 * expect(spy(1)).toEqual({ id: 1, name: 'Alice' })
 * expect(() => spy(2)).toThrow()
 */
export function when<Fn extends Procedure>(spy: Fn | Mock<Fn>, options?: WhenOptions<Fn>): When<Fn> {
  if (!isMockFunction(spy)) {
    throw new TypeError('`when` requires a mock function created with `vi.fn()` or `vi.spyOn()`')
  }

  type ScopedParameters = Parameters<Fn>
  type ScopedReturn = ReturnType<Fn>

  const behaviors: Behavior<ScopedParameters, ScopedReturn>[] = []
  const originalImplementation = spy.getMockImplementation()

  function findAction(args: ScopedParameters) {
    const testers = [
      ...getCustomEqualityTesters(),
      iterableEquality,
    ]

    for (const behavior of behaviors) {
      if (equals(args, behavior.arguments, testers)) {
        return behavior.actions.findLast(action => !(action.remaining === 0 && action.called)) ?? null
      }
    }

    return null
  }

  spy.mockImplementation(
    // @ts-expect-error cannot resolve generic args
    (...args: ScopedParameters) => {
      const action = findAction(args)

      if (action === null) {
        const onUnmatched = typeof options?.onUnmatched === 'function'
          ? options.onUnmatched
          : options?.onUnmatched === 'throw'
            ? () => {
                throw new Error(`vi.when: no behavior defined when called with [${args.map(arg => stringify(arg)).join(', ')}]`)
              }
            : originalImplementation
        return onUnmatched?.(...args)
      }

      action.remaining -= 1
      action.called = true

      switch (action.type) {
        case 'return': {
          return action.value
        }

        case 'throw': {
          throw action.value
        }

        case 'resolve': {
          return Promise.resolve(action.value)
        }

        case 'reject': {
          return Promise.reject(action.value)
        }
      }
    },
  )

  function getOrCreateBehavior(args: ScopedParameters) {
    const testers = [
      ...getCustomEqualityTesters(),
      iterableEquality,
    ]

    let behavior = behaviors.find(behavior => equals(args, behavior.arguments, testers))

    if (behavior === undefined) {
      behavior = {
        arguments: args,
        actions: [],
      }

      behaviors.push(behavior)
    }

    return behavior
  }

  // @ts-expect-error `Symbol.dispose` has to be assigned conditionally since it's only supported in Node >= 24
  const output: When<Fn> = {
    // @todo strictlyCalledWith for strict equality?
    'calledWith': (...args: ScopedParameters) => {
      const behavior = getOrCreateBehavior(args)

      function appendAction(behavior: Behavior<ScopedParameters, ScopedReturn>, type: BehaviorType, value: unknown, times: number) {
        behavior.actions.push({
          type,
          value,
          times,
          remaining: times,
          called: false,
        })
      }

      const calledWithInstance: CalledWithInstance<ScopedReturn, Fn> = ({
        ...output,
        thenThrow: (value, options) => {
          validateOptions(options)
          appendAction(behavior, 'throw', value, options?.times ?? Number.POSITIVE_INFINITY)

          return calledWithInstance
        },
        thenThrowOnce: (value) => {
          appendAction(behavior, 'throw', value, 1)

          return calledWithInstance
        },
        thenReturn: (value, options) => {
          validateOptions(options)
          appendAction(behavior, 'return', value, options?.times ?? Number.POSITIVE_INFINITY)

          return calledWithInstance
        },
        thenReturnOnce: (value) => {
          appendAction(behavior, 'return', value, 1)

          return calledWithInstance
        },
        thenResolve: (value, options) => {
          validateOptions(options)
          appendAction(behavior, 'resolve', value, options?.times ?? Number.POSITIVE_INFINITY)

          return calledWithInstance
        },
        thenResolveOnce: (value) => {
          appendAction(behavior, 'resolve', value, 1)

          return calledWithInstance
        },
        thenReject: (value, options) => {
          validateOptions(options)
          appendAction(behavior, 'reject', value, options?.times ?? Number.POSITIVE_INFINITY)

          return calledWithInstance
        },
        thenRejectOnce: (value) => {
          appendAction(behavior, 'reject', value, 1)

          return calledWithInstance
        },
      })

      return calledWithInstance
    },
    '~getDiagnostics': () => {
      const pendingBehaviors = behaviors
        .filter(behavior =>
          behavior.actions.some(action =>
            /* times-behaviors reached 0 */ action.remaining !== 0
            /* infinite behaviors called at least once */ && !(action.remaining === Number.POSITIVE_INFINITY && action.called),
          ),
        )

      return {
        isExhausted: behaviors.length !== 0 && pendingBehaviors.length === 0,
        pendingBehaviors: pendingBehaviors
          .map(behavior => `calledWith(${behavior.arguments.map(argument => stringify(argument)).join(', ')})\n${formatActions(behavior.actions)}`)
          .join('\n\n'),
      }
    },
  } satisfies Omit<When<Fn>, symbol>

  if (Symbol.dispose) {
    output[Symbol.dispose] = () => {
      spy.mockImplementation(
        // @ts-expect-error without an original implementation we should fall back to an undefined-returning function as that's what the mocking functions do
        originalImplementation ?? noop,
      )
    }
  }

  Reflect.defineProperty(output, whenSymbol, {
    enumerable: false,
    configurable: false,
    writable: false,
  })

  return output
}

function formatActions(actions: Behavior<unknown[], unknown>['actions']): string {
  const lines = actions.map((action, index) => {
    const method = getMethodName(action.type)
    const symbol = getSymbol(action)
    const left = `  ${symbol} ${method}(${stringify(action.value)}${action.times === Number.POSITIVE_INFINITY ? '' : `, { times: ${action.times} }`})`
    const unreachable = !isExhausted(action)
      && actions.slice(index + 1).some(later => later.times === Number.POSITIVE_INFINITY)
    const remaining = getRemainingLabel(action) + (unreachable ? '  ⚠ unreachable' : '')

    return { left, remaining }
  })

  const maxLeft = Math.max(...lines.map(line => line.left.length))

  return lines
    .map(({ left, remaining }) => `${left.padEnd(maxLeft + 2)}${remaining}`)
    .join('\n')
}

function getMethodName(type: BehaviorType): string {
  switch (type) {
    case 'return': {
      return 'thenReturn'
    }
    case 'resolve': {
      return 'thenResolve'
    }
    case 'throw': {
      return 'thenThrow'
    }
    case 'reject': {
      return 'thenReject'
    }
    default: {
      (type satisfies never)

      throw new Error(`vi.when: "${type}" is not a known method`)
    }
  }
}

function isExhausted(action: Behavior<unknown[], unknown>['actions'][number]): boolean {
  return action.remaining === 0 || (action.remaining === Number.POSITIVE_INFINITY && action.called)
}

function getRemainingLabel(action: Behavior<unknown[], unknown>['actions'][number]): string {
  if (isExhausted(action)) {
    return action.remaining === Number.POSITIVE_INFINITY
      ? 'exhausted'
      : `exhausted (${action.times} of ${action.times})`
  }

  return action.remaining === Number.POSITIVE_INFINITY
    ? 'never called'
    : `${action.remaining} remaining (of ${action.times})`
}

function getSymbol(action: Behavior<unknown[], unknown>['actions'][number]): string {
  if (isExhausted(action)) {
    return '✓'
  }

  return '✗'
}

function validateOptions(options: BehaviorOptions | undefined) {
  if (typeof options?.times === 'number' && options.times <= 0) {
    throw new RangeError('vi.when: `times` option must be greater than 0')
  }
}
