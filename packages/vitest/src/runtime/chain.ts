export type ChainableFunction<T extends string, F extends (...args: any[]) => any> = F & {
  [x in T]: ChainableFunction<T, F>
}

export function createChainable<T extends string, F extends (this: Record<T, boolean | undefined>, ...args: any[]) => any>(
  keys: T[],
  fn: F,
): ChainableFunction<T, ((...args: Parameters<F>) => ReturnType<F>)> {
  function create(obj: Record<T, boolean | undefined>) {
    const chain = function (this: any, ...args: Parameters<F>) {
      return fn.apply(obj, args)
    }
    for (const key of keys) {
      Object.defineProperty(chain, key, {
        get() {
          return create({ ...obj, [key]: true })
        },
      })
    }
    return chain
  }

  const chain = create({} as any) as any
  chain.fn = fn
  return chain
}
