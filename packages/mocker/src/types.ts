type Awaitable<T> = T | PromiseLike<T>

export type ModuleMockFactoryWithHelper<M = unknown> = (
  importOriginal: <T extends M = M>() => Promise<T>
) => Awaitable<Partial<M>>
export type ModuleMockFactory = () => any
export interface ModuleMockOptions {
  spy?: boolean
}
