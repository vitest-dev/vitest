/**
 * https://github.com/mmkal/expect-type/blob/14cd7e2262ca99b793b6cfedd18015103614393f/src/index.ts
 */

export type Not<T extends boolean> = T extends true ? false : true
export type Or<Types extends boolean[]> = Types[number] extends false ? false : true
export type And<Types extends boolean[]> = Types[number] extends true ? true : false
export type Eq<Left extends boolean, Right extends boolean> = Left extends true ? Right : Not<Right>
export type Xor<Types extends [boolean, boolean]> = Not<Eq<Types[0], Types[1]>>

const secret = Symbol('secret')
type Secret = typeof secret

export type IsNever<T> = [T] extends [never] ? true : false
export type IsAny<T> = [T] extends [Secret] ? Not<IsNever<T>> : false
export type IsUnknown<T> = [unknown] extends [T] ? Not<IsAny<T>> : false
export type IsNeverOrAny<T> = Or<[IsNever<T>, IsAny<T>]>

/**
 * Recursively walk a type and replace it with a branded type related to the original. This is useful for
 * equality-checking stricter than `A extends B ? B extends A ? true : false : false`, because it detects
 * the difference between a few edge-case types that vanilla typescript doesn't by default:
 * - `any` vs `unknown`
 * - `{ readonly a: string }` vs `{ a: string }`
 * - `{ a?: string }` vs `{ a: string | undefined }`
 */
export type DeepBrand<T> = IsNever<T> extends true
  ? { type: 'never' }
  : IsAny<T> extends true
    ? { type: 'any' }
    : IsUnknown<T> extends true
      ? { type: 'unknown' }
      : T extends string | number | boolean | symbol | bigint | null | undefined | void
        ? {
            type: 'primitive'
            value: T
          }
        : T extends new (...args: any[]) => any
          ? {
              type: 'constructor'
              params: ConstructorParams<T>
              instance: DeepBrand<InstanceType<Extract<T, new (...args: any) => any>>>
            }
          : T extends (...args: infer P) => infer R // avoid functions with different params/return values matching
            ? {
                type: 'function'
                params: DeepBrand<P>
                return: DeepBrand<R>
              }
            : T extends any[]
              ? {
                  type: 'array'
                  items: { [K in keyof T]: T[K] }
                }
              : {
                  type: 'object'
                  properties: { [K in keyof T]: DeepBrand<T[K]> }
                  readonly: ReadonlyKeys<T>
                  required: RequiredKeys<T>
                  optional: OptionalKeys<T>
                  constructorParams: DeepBrand<ConstructorParams<T>>
                }

export type RequiredKeys<T> = Extract<
  {
    [K in keyof T]-?: {} extends Pick<T, K> ? never : K
  }[keyof T],
  keyof T
>
export type OptionalKeys<T> = Exclude<keyof T, RequiredKeys<T>>

// adapted from some answers to https://github.com/type-challenges/type-challenges/issues?q=label%3A5+label%3Aanswer
// prettier-ignore
export type ReadonlyKeys<T> = Extract<{
  [K in keyof T]-?: ReadonlyEquivalent<
    { [_K in K]: T[K] },
    { -readonly [_K in K]: T[K] }
  > extends true ? never : K;
}[keyof T], keyof T>

// prettier-ignore
type ReadonlyEquivalent<X, Y> = Extends<
  (<T>() => T extends X ? true : false),
  (<T>() => T extends Y ? true : false)
>

export type Extends<L, R> = IsNever<L> extends true ? IsNever<R> : L extends R ? true : false
export type StrictExtends<L, R> = Extends<DeepBrand<L>, DeepBrand<R>>

export type Equal<Left, Right> = And<[StrictExtends<Left, Right>, StrictExtends<Right, Left>]>

export type Params<Actual> = Actual extends (...args: infer P) => any ? P : never
export type ConstructorParams<Actual> = Actual extends new (...args: infer P) => any
  ? Actual extends new () => any
    ? P | []
    : P
  : never

export type MismatchArgs<B extends boolean, C extends boolean> = Eq<B, C> extends true ? [] : [never]

export const createIndexMap = (source: string) => {
  const map = new Map<string, number>()
  let index = 0
  let line = 1
  let column = 1
  for (const char of source) {
    map.set(`${line}:${column}`, index++)
    if (char === '\n' || char === '\r\n') {
      line++
      column = 0
    }
    else {
      column++
    }
  }
  return map
}

// const getTockenChar = (source: string, index: number, offset: number) => {
//   let char = source[index += offset]
//   while (index >= 0 && /\s/.test(char)) {
//     index += offset
//     char = source[index]
//   }
//   return char
// }

// const getTockenIndex = (source: string, index: number, offset: number, char: string) => {
//   let currentChar = source[index]
//   while (index >= 0 && currentChar !== char) {
//     index += offset
//     currentChar = source[index]
//   }
//   return index
// }

// const getMethod = (source: string, index: number): string | null => {
//   if (index == null)
//     return null
//   const prevChar = getTockenChar(source, index, -1)
//   // .toBe()
//   // ^~~~~~
//   if (prevChar === '.') {
//     const [method] = source.slice(index).match(/[^<(]+/) || []
//     return method
//   }
//   // .toBe(value)
//   //      ^~~~~~
//   const startIndex = getTockenIndex(source, index, -1, '.')
//   const [method] = source.slice(startIndex + 1).replace(/\s*/, '').match(/[^<(]+/) || []
//   // toBe<Type.Some>(value) case -> method = Some>
//   // toBe<Type['some.dotted.notation']>(value) case -> method = Some>
//   if (!method.includes('>'))
//     return method
//   const closestNonTypeDot = getTockenIndex(source, startIndex, -1, '<')
//   return getMethod(source, closestNonTypeDot)
// }
