import type { Mock, Procedure } from '@vitest/spy'
import type { Disposable } from 'vitest/optional-runtime-types.js'
import { equals, getCustomEqualityTesters, iterableEquality } from '@vitest/expect'
import { isMockFunction } from '@vitest/spy'

type BehaviorType = 'return' | 'throw' | 'resolve' | 'reject'

interface Behavior<Arguments extends unknown[], Value> {
  arguments: Arguments
  actions: {
    type: BehaviorType
    value: Value | unknown
    times: number
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
type CalledWithInstance<ReturnType, Fn extends Procedure> = When<Fn> & Record<
  | 'thenReturn'
  | 'thenResolve',
  (value: ReturnType, options?: BehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>
> & Record<
  | 'thenReturnOnce'
  | 'thenResolveOnce',
  (value: ReturnType, options?: OnceBehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>
> & Record<
  | 'thenThrow'
  | 'thenReject',
  (value: unknown, options?: BehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>
> & Record<
  | 'thenThrowOnce'
  | 'thenRejectOnce',
  (value: unknown, options?: OnceBehaviorOptions | undefined) => CalledWithInstance<ReturnType, Fn>
>

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
  calledWith: (...args: Parameters<Fn>) => CalledWithInstance<ReturnType<Fn>, Fn>
  /**
   * Returns `true` if every registered behavior has been consumed:
   * - finite behaviors (registered with `times` or `*Once`) must have reached `0` remaining calls
   * - infinite behaviors must have been called at least once
   *
   * Returns `false` otherwise or if no behaviors have been registered.
   *
   * @example
   * const w = vi.when(spy).calledWith('hello').thenReturnOnce('HELLO')
   *
   * expect(spy('hello')).toBe('HELLO')
   * expect(w.isExhausted()).toBe(true)
   *
   * @example
   * const w = vi.when(spy).calledWith(1).thenReturnOnce(42)
   *
   * expect(w.isExhausted()).toBe(false)
   */
  isExhausted: () => boolean
}

/**
 * Options for {@linkcode when|vi.when}.
 */
interface WhenOptions {
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
  onUnmatched?: 'throw' | 'passthrough' | Procedure | undefined
}

function throwUnmatched() {
  throw new Error('vi.when: no behavior defined') // @todo improve error message
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
export function when<Fn extends Procedure>(spy: Fn | Mock<Fn>, options?: WhenOptions): When<Fn> {
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
        return behavior.actions.findLast(action => !(action.times === 0 && action.called)) ?? null
      }
    }

    return null
  }

  const onUnmatched = typeof options?.onUnmatched === 'function'
    ? options.onUnmatched
    : options?.onUnmatched === 'throw'
      ? throwUnmatched
      : originalImplementation

  spy.mockImplementation(
    // @ts-expect-error cannot resolve generic args
    (...args: ScopedParameters) => {
      const action = findAction(args)

      if (action === null) {
        return onUnmatched?.(...args)
      }

      action.times -= 1
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
    calledWith: (...args: ScopedParameters) => {
      const behavior = getOrCreateBehavior(args)

      function appendAction(behavior: Behavior<ScopedParameters, ScopedReturn>, type: BehaviorType, value: unknown, times: number) {
        behavior.actions.push({
          type,
          value,
          times,
          called: false,
        })
      }

      const calledWithInstance: CalledWithInstance<ScopedReturn, Fn> = ({
        ...output,
        thenThrow: (value, options) => {
          appendAction(behavior, 'throw', value, options?.times ?? Number.POSITIVE_INFINITY)

          return calledWithInstance
        },
        thenThrowOnce: (value) => {
          appendAction(behavior, 'throw', value, 1)

          return calledWithInstance
        },
        thenReturn: (value, options) => {
          appendAction(behavior, 'return', value, options?.times ?? Number.POSITIVE_INFINITY)

          return calledWithInstance
        },
        thenReturnOnce: (value) => {
          appendAction(behavior, 'return', value, 1)

          return calledWithInstance
        },
        thenResolve: (value, options) => {
          appendAction(behavior, 'resolve', value, options?.times ?? Number.POSITIVE_INFINITY)

          return calledWithInstance
        },
        thenResolveOnce: (value) => {
          appendAction(behavior, 'resolve', value, 1)

          return calledWithInstance
        },
        thenReject: (value, options) => {
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
    isExhausted: () => {
      if (behaviors.length === 0) {
        return false
      }

      return behaviors.every(behavior =>
        behavior.actions.every(action =>
          /* times-behaviors reached 0 */ action.times === 0
          /* infinite behaviors called at least once */ || (action.times === Number.POSITIVE_INFINITY && action.called),
        ),
      )
    },
  } satisfies Omit<When<Fn>, symbol>

  if (Symbol.dispose) {
    output[Symbol.dispose] = () => {
      if (originalImplementation) {
        spy.mockImplementation(originalImplementation)
      }
    }
  }

  return output
}
