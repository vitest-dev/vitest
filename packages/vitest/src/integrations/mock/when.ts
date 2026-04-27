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
  times?: number | undefined
}

type OnceBehaviorOptions = Omit<BehaviorOptions, 'times'>

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

interface When<Fn extends Procedure> extends Disposable {
  calledWith: (...args: Parameters<Fn>) => CalledWithInstance<ReturnType<Fn>, Fn>
  isExhausted: () => boolean
}

interface WhenOptions {
  onUnmatched?: 'throw' | 'passthrough' | Procedure | undefined
}

function throwUnmatched() {
  throw new Error('no behavior found in when') // @todo improve error message
}

export function when<Fn extends Procedure>(spy: Fn | Mock<Fn>, options?: WhenOptions): When<Fn> {
  if (!isMockFunction(spy)) {
    throw new TypeError('`when` should be called with a spy') // @todo improve the error message
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

  // @ts-expect-error `Symbol.dispose` has to be assigned conditionally since it's only supported in Node 24
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
