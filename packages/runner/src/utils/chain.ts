export type ChainableFunction<T extends string, Args extends any[], R = any, E = {}> = {
  (...args: Args): R
} & {
  [x in T]: ChainableFunction<T, Args, R, E>
} & {
  fn: (this: Record<T, any>, ...args: Args) => R
} & E

export function createChainable<T extends string, Args extends any[], R = any, E = {}>(
  keys: T[],
  fn: (this: Record<T, any>, ...args: Args) => R,
  initialContext?: Record<T, any>,
): ChainableFunction<T, Args, R, E> {
  function create(context: Record<T, any>) {
    const chain = function (this: any, ...args: Args) {
      return fn.apply(context, args)
    }
    Object.assign(chain, fn)
    chain.withContext = () => chain.bind(context)
    chain.setContext = (key: T, value: any) => {
      context[key] = value
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

  const chain = create(initialContext || {} as any) as any
  chain.fn = fn
  return chain
}
