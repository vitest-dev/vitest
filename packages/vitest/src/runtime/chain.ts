export type ChainableFunction<T extends string, Args extends any[], R = any, E = {}> = {
  (...args: Args): R
} & {
  [x in T]: ChainableFunction<T, Args, R, E>
} & E

export function createChainable<T extends string, Args extends any[], R = any, E = {}>(
  keys: T[],
  fn: (this: Record<T, boolean | undefined>, ...args: Args) => R,
): ChainableFunction<T, Args, R, E> {
  function create(context: Record<T, boolean | undefined>) {
    const chain = function (this: any, ...args: Args) {
      return fn.apply(context, args)
    }
    Object.assign(chain, fn)
    chain.withContext = () => chain.bind(context)
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
