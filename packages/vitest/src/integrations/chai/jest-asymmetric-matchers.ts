import * as matcherUtils from './jest-matcher-utils'

import {
  equals,
  isA,
} from './jest-utils'
import type {
  MatcherState,
  ChaiPlugin,
} from './types'

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

export function JestAsymmetricMatchers(): ChaiPlugin {
  return (chai, utils) => {
    utils.addMethod(
      chai.expect,
      'stringContaining',
      (expected: string) => new StringContaining(expected),
    )
  }
}
