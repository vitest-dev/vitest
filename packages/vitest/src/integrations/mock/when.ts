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
    once: boolean
    called: boolean
  }[]
}

type CalledWithInstance<ReturnType, Fn extends Procedure> = When<Fn> & Record<
  | 'thenReturn'
  | 'thenReturnOnce'
  | 'thenResolve'
  | 'thenResolveOnce',
  (value: ReturnType) => CalledWithInstance<ReturnType, Fn>
> & Record<
  | 'thenThrow'
  | 'thenThrowOnce'
  | 'thenReject'
  | 'thenRejectOnce',
  (value: unknown) => CalledWithInstance<ReturnType, Fn>
>

interface When<Fn extends Procedure> extends Disposable {
  calledWith: (...args: Parameters<Fn>) => CalledWithInstance<ReturnType<Fn>, Fn>
}

export function when<Fn extends Procedure>(spy: Fn | Mock<Fn>): When<Fn> {
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
        return behavior.actions.findLast(action => !(action.once && action.called)) ?? null
      }
    }

    return null
  }

  spy.mockImplementation(
    // @ts-expect-error cannot resolve generic args
    (...args: ScopedParameters) => {
      const action = findAction(args)

      if (action === null) {
        return originalImplementation?.(...args)
      }

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

      function appendAction(behavior: Behavior<ScopedParameters, ScopedReturn>, type: BehaviorType, value: unknown, once: boolean) {
        behavior.actions.push({
          type,
          value,
          once,
          called: false,
        })
      }

      const calledWithInstance: CalledWithInstance<ScopedReturn, Fn> = ({
        ...output,
        thenThrow: (value) => {
          appendAction(behavior, 'throw', value, false)

          return calledWithInstance
        },
        thenThrowOnce: (value) => {
          appendAction(behavior, 'throw', value, true)

          return calledWithInstance
        },
        thenReturn: (value) => {
          appendAction(behavior, 'return', value, false)

          return calledWithInstance
        },
        thenReturnOnce: (value) => {
          appendAction(behavior, 'return', value, true)

          return calledWithInstance
        },
        thenResolve: (value) => {
          appendAction(behavior, 'resolve', value, false)

          return calledWithInstance
        },
        thenResolveOnce: (value) => {
          appendAction(behavior, 'resolve', value, true)

          return calledWithInstance
        },
        thenReject: (value) => {
          appendAction(behavior, 'reject', value, false)

          return calledWithInstance
        },
        thenRejectOnce: (value) => {
          appendAction(behavior, 'reject', value, true)

          return calledWithInstance
        },
      })

      return calledWithInstance
    },
  }

  if (Symbol.dispose) {
    output[Symbol.dispose] = () => {
      if (originalImplementation) {
        spy.mockImplementation(originalImplementation)
      }
    }
  }

  return output
}
