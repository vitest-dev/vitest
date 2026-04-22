import type { Mock, Procedure } from '@vitest/spy'
import { equals, getCustomEqualityTesters, iterableEquality } from '@vitest/expect'

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

export function when<T extends Procedure>(spy: T | Mock<T>): When<T> {
  return new When(spy)
}

class When<Fn extends Procedure> {
  #behaviors: Behavior<Parameters<Fn>, ReturnType<Fn>>[]

  constructor(spy: Fn | Mock<Fn>) {
    this.#behaviors = []

    if (!('_isMockFunction' in spy && spy._isMockFunction)) {
      throw new TypeError('`when` should be called with a spy') // @todo improve the error message
    }

    const originalImplementation = spy.getMockImplementation()

    spy.mockImplementation(
      // @ts-expect-error cannot resolve generic args
      (...args: Parameters<Fn>) => {
        const action = this.#findAction(args)

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
  }

  // @todo strictlyCalledWith for strict equality?
  calledWith(...args: Parameters<Fn>) {
    const behavior = this.#getOrCreateBehavior(args)

    return {
      thenThrow: (value: unknown): this => {
        this.#appendAction(behavior, 'throw', value, false)

        return this
      },
      thenThrowOnce: (value: unknown): this => {
        this.#appendAction(behavior, 'throw', value, true)

        return this
      },
      thenReturn: (value: ReturnType<Fn>): this => {
        this.#appendAction(behavior, 'return', value, false)

        return this
      },
      thenReturnOnce: (value: ReturnType<Fn>): this => {
        this.#appendAction(behavior, 'return', value, true)

        return this
      },
      thenResolve: (value: ReturnType<Fn>): this => {
        this.#appendAction(behavior, 'resolve', value, false)

        return this
      },
      thenResolveOnce: (value: ReturnType<Fn>): this => {
        this.#appendAction(behavior, 'resolve', value, true)

        return this
      },
      thenReject: (value: unknown): this => {
        this.#appendAction(behavior, 'reject', value, false)

        return this
      },
      thenRejectOnce: (value: unknown): this => {
        this.#appendAction(behavior, 'reject', value, true)

        return this
      },
    }
  }

  #getOrCreateBehavior(args: Parameters<Fn>) {
    const testers = [
      ...getCustomEqualityTesters(),
      iterableEquality,
    ]

    let behavior = this.#behaviors.find(behavior => equals(args, behavior.arguments, testers))

    if (behavior === undefined) {
      behavior = {
        arguments: args,
        actions: [],
      }

      this.#behaviors.push(behavior)
    }

    return behavior
  }

  #appendAction(behavior: Behavior<Parameters<Fn>, ReturnType<Fn>>, type: BehaviorType, value: unknown, once: boolean) {
    behavior.actions.push({
      type,
      value,
      once,
      called: false,
    })
  }

  #findAction(args: Parameters<Fn>) {
    const testers = [
      ...getCustomEqualityTesters(),
      iterableEquality,
    ]

    for (const behavior of this.#behaviors) {
      if (equals(args, behavior.arguments, testers)) {
        return behavior.actions.findLast(action => !(action.once && action.called)) ?? null
      }
    }

    return null
  }
}
