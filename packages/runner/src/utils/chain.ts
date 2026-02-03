import type { InternalChainableContext, SuiteAPI, TestAPI } from '../types/tasks'

export type ChainableFunction<
  T extends string,
  F extends (...args: any) => any,
  C = object,
> = F & {
  [x in T]: ChainableFunction<T, F, C>;
} & {
  fn: (this: Record<T, any>, ...args: Parameters<F>) => ReturnType<F>
} & C

export const kChainableContext: unique symbol = Symbol('kChainableContext')

export function getChainableContext(chainable: SuiteAPI): InternalChainableContext
export function getChainableContext(chainable: TestAPI): InternalChainableContext
export function getChainableContext(chainable: any): InternalChainableContext | undefined
export function getChainableContext(chainable: any): InternalChainableContext | undefined {
  return chainable?.[kChainableContext]
}

export function createChainable<T extends string, Args extends any[], R = any>(
  keys: T[],
  fn: (this: Record<T, any>, ...args: Args) => R,
  context?: Record<string, any>,
): ChainableFunction<T, (...args: Args) => R> {
  function create(context: Record<T, any>) {
    const chain = function (this: any, ...args: Args) {
      return fn.apply(context, args)
    }
    Object.assign(chain, fn)
    Object.defineProperty(chain, kChainableContext, {
      value: {
        withContext: () => chain.bind(context),
        getFixtures: () => (context as any).fixtures,
        setContext: (key: T, value: any) => {
          context[key] = value
        },
        mergeContext: (ctx: Record<T, any>) => {
          Object.assign(context, ctx)
        },
      },
      enumerable: false,
    })
    for (const key of keys) {
      Object.defineProperty(chain, key, {
        get() {
          return create({ ...context, [key]: true })
        },
      })
    }
    return chain
  }

  const chain = create(context ?? {} as any) as any
  Object.defineProperty(chain, 'fn', {
    value: fn,
    enumerable: false,
  })
  return chain
}
