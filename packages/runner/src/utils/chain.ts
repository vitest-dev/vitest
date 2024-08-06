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
): ChainableFunction<T, (...args: Args) => R> {
  function create(context: Record<T, any>) {
    const chain = function (this: any, ...args: Args) {
      return fn.apply(context, args)
    }
    Object.assign(chain, fn)
    chain.withContext = () => chain.bind(context)
    chain.setContext = (key: T, value: any) => {
      context[key] = value
    }
    chain.mergeContext = (ctx: Record<T, any>) => {
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

  const chain = create({} as any) as any
  chain.fn = fn
  return chain
}
