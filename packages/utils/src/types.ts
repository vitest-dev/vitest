export type Awaitable<T> = T | PromiseLike<T>
export type Nullable<T> = T | null | undefined
export type Arrayable<T> = T | Array<T>
export type ArgumentsType<T> = T extends (...args: infer U) => any ? U : never

export type MergeInsertions<T> = T extends object
  ? { [K in keyof T]: MergeInsertions<T[K]> }
  : T

export type DeepMerge<F, S> = MergeInsertions<{
  [K in keyof F | keyof S]: K extends keyof S & keyof F
    ? DeepMerge<F[K], S[K]>
    : K extends keyof S
      ? S[K]
      : K extends keyof F
        ? F[K]
        : never;
}>

export interface Constructable {
  new (...args: any[]): any
}

export interface ParsedStack {
  method: string
  file: string
  line: number
  column: number
}

export interface SerializedError {
  message: string
  stacks?: ParsedStack[]
  stack?: string
  name?: string
  cause?: SerializedError
  [key: string]: unknown
}

export interface TestError extends SerializedError {
  cause?: TestError
  diff?: string
  actual?: string
  expected?: string
}

/**
 * Requires at least one of the specified keys to be present.
 * Other keys in the set remain optional.
 *
 * @template T - The object type.
 * @template K - The keys of which at least one is required. Defaults to all keys.
 *
 * @example
 * type Point = AtLeastOneOf<{ x: number; y: number }>
 *
 * const a: Point = { x: 1 }
 * const b: Point = { y: 2 }
 * const c: Point = { x: 1, y: 2 }
 *
 * @example
 *  type Action = AtLeastOneOf<{ id: number; name: string; force: boolean }, 'id' | 'name'>
 *
 * const a: Action = { id: 1, force: false }
 * const b: Action = { name: 'foo', force: true }
 * const c: Action = { id: 1, name: 'foo', force: true }
 */
export type AtLeastOneOf<T extends Record<PropertyKey, unknown>, K extends keyof T = keyof T> = {
  [Key in K]: Required<Pick<T, Key>> & Partial<Pick<T, Exclude<K, Key>>>
}[K] & Omit<T, K>

/**
 * Requires exactly one of the specified keys to be present.
 * Other keys in the set are forbidden.
 *
 * @template T - The object type.
 * @template K - The keys of which exactly one is required. Defaults to all keys.
 *
 * @example
 * type Input = ExactlyOneOf<{ a: string; b: string }>
 *
 * const a: Input = { a: 'foo' }
 * const b: Input = { b: 'bar' }
 *
 *  @example
 * type Query = ExactlyOneOf<{ id: number; path: string; all: boolean }, 'id' | 'path'>
 *
 * const a: Query = { id: 1, all: true }
 * const b: Query = { path: 'foo', all: false }
 */
export type ExactlyOneOf<T extends Record<PropertyKey, unknown>, K extends keyof T = keyof T> = {
  [Key in K]: Required<Pick<T, Key>> & Partial<Record<Exclude<K, Key>, never>>
}[K] & Omit<T, K>
