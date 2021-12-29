import * as matcherUtils from './jest-matcher-utils'

import { equals, isA } from './jest-utils'
import type { ChaiPlugin, MatcherState } from './types'

export interface AsymmetricMatcherInterface {
  asymmetricMatch(other: unknown): boolean
  toString(): string
  getExpectedType?(): string
  toAsymmetricMatcher?(): string
}

export abstract class AsymmetricMatcher<
  T,
  State extends MatcherState = MatcherState,
> implements AsymmetricMatcherInterface {
  $$typeof = Symbol.for('jest.asymmetricMatcher')

  constructor(protected sample: T, protected inverse = false) {}

  protected getMatcherContext(): State {
    return {
      equals,
      isNot: this.inverse,
      utils: matcherUtils,
    } as any
  }

  abstract asymmetricMatch(other: unknown): boolean
  abstract toString(): string
  getExpectedType?(): string
  toAsymmetricMatcher?(): string
}

export class StringContaining extends AsymmetricMatcher<string> {
  constructor(sample: string, inverse = false) {
    if (!isA('String', sample))
      throw new Error('Expected is not a string')

    super(sample, inverse)
  }

  asymmetricMatch(other: string) {
    const result = isA('String', other) && other.includes(this.sample)

    return this.inverse ? !result : result
  }

  toString() {
    return `String${this.inverse ? 'Not' : ''}Containing`
  }

  getExpectedType() {
    return 'string'
  }
}

export class Anything extends AsymmetricMatcher<void> {
  asymmetricMatch(other: unknown) {
    return other != null
  }

  toString() {
    return 'Anything'
  }

  toAsymmetricMatcher() {
    return 'Anything'
  }
}

export class ObjectContaining extends AsymmetricMatcher<Record<string, unknown>> {
  constructor(sample: Record<string, unknown>, inverse = false) {
    super(sample, inverse)
  }

  getPrototype(obj: object) {
    if (Object.getPrototypeOf)
      return Object.getPrototypeOf(obj)

    if (obj.constructor.prototype === obj)
      return null

    return obj.constructor.prototype
  }

  hasProperty(obj: object | null, property: string): boolean {
    if (!obj)
      return false

    if (Object.prototype.hasOwnProperty.call(obj, property))
      return true

    return this.hasProperty(this.getPrototype(obj), property)
  }

  asymmetricMatch(other: any) {
    if (typeof this.sample !== 'object') {
      throw new TypeError(
        `You must provide an object to ${this.toString()}, not '${
          typeof this.sample
        }'.`,
      )
    }

    let result = true

    // eslint-disable-next-line no-restricted-syntax
    for (const property in this.sample) {
      if (!this.hasProperty(other, property) || !equals(this.sample[property], other[property])) {
        result = false
        break
      }
    }

    return this.inverse ? !result : result
  }

  toString() {
    return `Object${this.inverse ? 'Not' : ''}Containing`
  }

  getExpectedType() {
    return 'object'
  }
}

export class ArrayContaining extends AsymmetricMatcher<Array<unknown>> {
  constructor(sample: Array<unknown>, inverse = false) {
    super(sample, inverse)
  }

  asymmetricMatch(other: Array<unknown>) {
    if (!Array.isArray(this.sample)) {
      throw new TypeError(
        `You must provide an array to ${this.toString()}, not '${
          typeof this.sample
        }'.`,
      )
    }

    const result
      = this.sample.length === 0
      || (Array.isArray(other)
        && this.sample.every(item =>
          other.some(another => equals(item, another)),
        ))

    return this.inverse ? !result : result
  }

  toString() {
    return `Array${this.inverse ? 'Not' : ''}Containing`
  }

  getExpectedType() {
    return 'array'
  }
}

export class Any extends AsymmetricMatcher<any> {
  constructor(sample: unknown) {
    if (typeof sample === 'undefined') {
      throw new TypeError(
        'any() expects to be passed a constructor function. '
          + 'Please pass one or use anything() to match any object.',
      )
    }
    super(sample)
  }

  fnNameFor(func: Function) {
    if (func.name)
      return func.name

    const functionToString = Function.prototype.toString

    const matches = functionToString
      .call(func)
      .match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/)
    return matches ? matches[1] : '<anonymous>'
  }

  asymmetricMatch(other: unknown) {
    if (this.sample === String)
      return typeof other == 'string' || other instanceof String

    if (this.sample === Number)
      return typeof other == 'number' || other instanceof Number

    if (this.sample === Function)
      return typeof other == 'function' || other instanceof Function

    if (this.sample === Boolean)
      return typeof other == 'boolean' || other instanceof Boolean

    if (this.sample === BigInt)
      return typeof other == 'bigint' || other instanceof BigInt

    if (this.sample === Symbol)
      return typeof other == 'symbol' || other instanceof Symbol

    if (this.sample === Object)
      return typeof other == 'object'

    return other instanceof this.sample
  }

  toString() {
    return 'Any'
  }

  getExpectedType() {
    if (this.sample === String)
      return 'string'

    if (this.sample === Number)
      return 'number'

    if (this.sample === Function)
      return 'function'

    if (this.sample === Object)
      return 'object'

    if (this.sample === Boolean)
      return 'boolean'

    return this.fnNameFor(this.sample)
  }

  toAsymmetricMatcher() {
    return `Any<${this.fnNameFor(this.sample)}>`
  }
}

export class StringMatching extends AsymmetricMatcher<RegExp> {
  constructor(sample: string | RegExp, inverse = false) {
    if (!isA('String', sample) && !isA('RegExp', sample))
      throw new Error('Expected is not a String or a RegExp')

    super(new RegExp(sample), inverse)
  }

  asymmetricMatch(other: string) {
    const result = isA('String', other) && this.sample.test(other)

    return this.inverse ? !result : result
  }

  toString() {
    return `String${this.inverse ? 'Not' : ''}Matching`
  }

  getExpectedType() {
    return 'string'
  }
}

export const JestAsymmetricMatchers: ChaiPlugin = (chai, utils) => {
  utils.addMethod(
    chai.expect,
    'anything',
    () => new Anything(),
  )

  utils.addMethod(
    chai.expect,
    'any',
    (expected: unknown) => new Any(expected),
  )

  utils.addMethod(
    chai.expect,
    'stringContaining',
    (expected: string) => new StringContaining(expected),
  )

  utils.addMethod(
    chai.expect,
    'objectContaining',
    (expected: any) => new ObjectContaining(expected),
  )

  utils.addMethod(
    chai.expect,
    'arrayContaining',
    (expected: any) => new ArrayContaining(expected),
  )

  utils.addMethod(
    chai.expect,
    'stringMatching',
    (expected: any) => new StringMatching(expected),
  )

  chai.expect.not = {
    stringContaining: (expected: string) => new StringContaining(expected, true),
    objectContaining: (expected: any) => new ObjectContaining(expected, true),
    arrayContaining: (expected: unknown[]) => new ArrayContaining(expected, true),
    stringMatching: (expected: string | RegExp) => new StringMatching(expected, true),
  }
}
