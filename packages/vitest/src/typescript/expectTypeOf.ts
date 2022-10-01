/**
 * https://github.com/mmkal/expect-type/blob/14cd7e2262ca99b793b6cfedd18015103614393f/src/index.ts
 */

import { EXPECT_TYPEOF_MATCHERS } from './constants'
import type {
  ConstructorParams,
  Equal,
  Extends,
  IsAny,
  IsNever,
  IsUnknown,
  MismatchArgs,
  Not,
  Params,
} from './utils'

export interface ExpectTypeOf<Actual, B extends boolean> {
  toBeAny: (...MISMATCH: MismatchArgs<IsAny<Actual>, B>) => true
  toBeUnknown: (...MISMATCH: MismatchArgs<IsUnknown<Actual>, B>) => true
  toBeNever: (...MISMATCH: MismatchArgs<IsNever<Actual>, B>) => true
  toBeFunction: (...MISMATCH: MismatchArgs<Extends<Actual, (...args: any[]) => any>, B>) => true
  toBeObject: (...MISMATCH: MismatchArgs<Extends<Actual, object>, B>) => true
  toBeArray: (...MISMATCH: MismatchArgs<Extends<Actual, any[]>, B>) => true
  toBeNumber: (...MISMATCH: MismatchArgs<Extends<Actual, number>, B>) => true
  toBeString: (...MISMATCH: MismatchArgs<Extends<Actual, string>, B>) => true
  toBeBoolean: (...MISMATCH: MismatchArgs<Extends<Actual, boolean>, B>) => true
  toBeVoid: (...MISMATCH: MismatchArgs<Extends<Actual, void>, B>) => true
  toBeSymbol: (...MISMATCH: MismatchArgs<Extends<Actual, symbol>, B>) => true
  toBeNull: (...MISMATCH: MismatchArgs<Extends<Actual, null>, B>) => true
  toBeUndefined: (...MISMATCH: MismatchArgs<Extends<Actual, undefined>, B>) => true
  toBeNullable: (...MISMATCH: MismatchArgs<Not<Equal<Actual, NonNullable<Actual>>>, B>) => true
  toMatch: {
    <Expected>(...MISMATCH: MismatchArgs<Extends<Actual, Expected>, B>): true
    <Expected>(expected: Expected, ...MISMATCH: MismatchArgs<Extends<Actual, Expected>, B>): true
  }
  toBe: {
    <Expected>(...MISMATCH: MismatchArgs<Equal<Actual, Expected>, B>): true
    <Expected>(expected: Expected, ...MISMATCH: MismatchArgs<Equal<Actual, Expected>, B>): true
  }
  toBeCallableWith: B extends true ? (...args: Params<Actual>) => true : never
  toBeConstructibleWith: B extends true ? (...args: ConstructorParams<Actual>) => true : never
  toHaveProperty: <K extends string>(
    key: K,
    ...MISMATCH: MismatchArgs<Extends<K, keyof Actual>, B>
  ) => K extends keyof Actual ? ExpectTypeOf<Actual[K], B> : true
  extract: <V>(v?: V) => ExpectTypeOf<Extract<Actual, V>, B>
  exclude: <V>(v?: V) => ExpectTypeOf<Exclude<Actual, V>, B>
  parameter: <K extends keyof Params<Actual>>(number: K) => ExpectTypeOf<Params<Actual>[K], B>
  parameters: ExpectTypeOf<Params<Actual>, B>
  constructorParameters: ExpectTypeOf<ConstructorParams<Actual>, B>
  instance: Actual extends new (...args: any[]) => infer I ? ExpectTypeOf<I, B> : never
  returns: Actual extends (...args: any[]) => infer R ? ExpectTypeOf<R, B> : never
  resolves: Actual extends PromiseLike<infer R> ? ExpectTypeOf<R, B> : never
  items: Actual extends ArrayLike<infer R> ? ExpectTypeOf<R, B> : never
  guards: Actual extends (v: any, ...args: any[]) => v is infer T ? ExpectTypeOf<T, B> : never
  asserts: Actual extends (v: any, ...args: any[]) => asserts v is infer T
    ? // Guard methods `(v: any) => asserts v is T` does not actually defines a return type. Thus, any function taking 1 argument matches the signature before.
  // In case the inferred assertion type `R` could not be determined (so, `unknown`), consider the function as a non-guard, and return a `never` type.
  // See https://github.com/microsoft/TypeScript/issues/34636
    unknown extends T
      ? never
      : ExpectTypeOf<T, B>
    : never
  not: ExpectTypeOf<Actual, Not<B>>
}
const fn: any = () => true

export interface _ExpectTypeOf {
  <Actual>(actual: Actual): ExpectTypeOf<Actual, true>
  <Actual>(): ExpectTypeOf<Actual, true>
  extend(matchers: Record<string, MatcherConfiguration>): void
}

interface MatcherConfiguration {
  message: string
}

const matchersConfiguration: Record<string, MatcherConfiguration> = {
  toBeAny: {
    message: 'expected type to be any',
  },
  toBeNull: {
    message: 'expected type to be null',
  },
  toBeNever: {
    message: 'expected type to be never',
  },
  toBe: {
    message: 'expected two types to be equal',
  },
  toBeUnknown: {
    message: 'expected type to be unknown',
  },
  toBeFunction: {
    message: 'expected type to be a function',
  },
  toBeObject: {
    message: 'expected type to be an object',
  },
  toBeArray: {
    message: 'expected type to be an array',
  },
  toBeString: {
    message: 'expected type to be a string',
  },
  toBeNumber: {
    message: 'expected type to be a number',
  },
  toBeBoolean: {
    message: 'expected type to be boolean',
  },
  toBeVoid: {
    message: 'expected type to be void',
  },
  toBeSymbol: {
    message: 'expected type to be a symbol',
  },
  toBeUndefined: {
    message: 'expected type to be undefined',
  },
  toBeNullable: {
    message: 'expected type to be nullable',
  },
  toMatch: {
    message: 'expected types to extend one another',
  },
  toBeCallableWith: {
    message: 'expected type to be callable with given arguments',
  },
  toBeConstructibleWith: {
    message: 'expected type to be constructible with given arguments',
  },
}

export const expectTypeOf: _ExpectTypeOf = (<Actual>(_actual?: Actual): ExpectTypeOf<Actual, true> => {
  const nonFunctionProperties = [
    'parameters',
    'returns',
    'resolves',
    'not',
    'items',
    'constructorParameters',
    'instance',
    'guards',
    'asserts',
  ] as const
  type Keys = keyof ExpectTypeOf<any, any>

  type FunctionsDict = Record<Exclude<Keys, typeof nonFunctionProperties[number]>, any>
  const obj: FunctionsDict = {
    toBeAny: fn,
    toBeUnknown: fn,
    toBeNever: fn,
    toBeFunction: fn,
    toBeObject: fn,
    toBeArray: fn,
    toBeString: fn,
    toBeNumber: fn,
    toBeBoolean: fn,
    toBeVoid: fn,
    toBeSymbol: fn,
    toBeNull: fn,
    toBeUndefined: fn,
    toBeNullable: fn,
    toMatch: fn,
    toBe: fn,
    toBeCallableWith: fn,
    toBeConstructibleWith: fn,
    extract: expectTypeOf,
    exclude: expectTypeOf,
    toHaveProperty: expectTypeOf,
    parameter: expectTypeOf,
  }

  const getterProperties: readonly Keys[] = nonFunctionProperties
  getterProperties.forEach((prop: Keys) => Object.defineProperty(obj, prop, { get: () => expectTypeOf({}) }))

  return obj as ExpectTypeOf<Actual, true>
}) as _ExpectTypeOf

// extend by calling setupFiles
expectTypeOf.extend = (matchers) => {
  for (const matcher in matchers)
    matchersConfiguration[matcher] = matchers[matcher]
}

Object.defineProperty(expectTypeOf, EXPECT_TYPEOF_MATCHERS, {
  value: matchersConfiguration,
})
