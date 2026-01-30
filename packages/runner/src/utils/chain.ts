export type ChainableFunction<
  T extends string,
  F extends (...args: any) => any,
  C = object,
> = F & {
  [x in T]: ChainableFunction<T, F, C>;
} & {
  fn: (this: Record<T, any>, ...args: Parameters<F>) => ReturnType<F>
} & C

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
    chain._withContext = () => chain.bind(context)
    chain._getFixtures = () => (context as any).fixtures
    chain._setContext = (key: T, value: any) => {
      context[key] = value
    }
    chain._mergeContext = (ctx: Record<T, any>) => {
      Object.assign(context, ctx)
    }
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
  chain.fn = fn
  return chain
}
