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

export class Anything extends AsymmetricMatcher<void>{
  asymmetricMatch(other: unknown) {
    return other !== void 0 && other !== null;
  }

  toString() {
    return 'Anything';
  }

  toAsymmetricMatcher() {
    return 'Anything';
  }
}


export class Any extends AsymmetricMatcher<any> {
  constructor(sample: unknown) {
    if (typeof sample === 'undefined') {
      throw new TypeError(
        'any() expects to be passed a constructor function. ' +
          'Please pass one or use anything() to match any object.',
      );
    }
    super(sample);
  }
 fnNameFor(func: Function) {
    if (func.name) {
      return func.name;
    }
    const functionToString = Function.prototype.toString;

    const matches = functionToString
      .call(func)
      .match(/^(?:async)?\s*function\s*\*?\s*([\w$]+)\s*\(/);
    return matches ? matches[1] : '<anonymous>';
  }

  asymmetricMatch(other: unknown) {
    if (this.sample == String) {
      return typeof other == 'string' || other instanceof String;
    }

    if (this.sample == Number) {
      return typeof other == 'number' || other instanceof Number;
    }

    if (this.sample == Function) {
      return typeof other == 'function' || other instanceof Function;
    }

    if (this.sample == Boolean) {
      return typeof other == 'boolean' || other instanceof Boolean;
    }

    if (this.sample == BigInt) {
      return typeof other == 'bigint' || other instanceof BigInt;
    }

    if (this.sample == Symbol) {
      return typeof other == 'symbol' || other instanceof Symbol;
    }

    if (this.sample == Object) {
      return typeof other == 'object';
    }

    return other instanceof this.sample;
  }

  toString() {
    return 'Any';
  }

  getExpectedType() {
    if (this.sample == String) {
      return 'string';
    }

    if (this.sample == Number) {
      return 'number';
    }

    if (this.sample == Function) {
      return 'function';
    }

    if (this.sample == Object) {
      return 'object';
    }

    if (this.sample == Boolean) {
      return 'boolean';
    }

    return this.fnNameFor(this.sample);
  }

  toAsymmetricMatcher() {
    return 'Any<' + this.fnNameFor(this.sample) + '>';
  }
}

export const JestAsymmetricMatchers: ChaiPlugin = (chai, utils) => {
  utils.addMethod(
    chai.expect,
    'stringContaining',
    (expected: string) => new StringContaining(expected),
  )

  utils.addMethod(
    chai.expect,
    'anything',
    () => {
      return new Anything()
    },
  )

  utils.addMethod(
    chai.expect,
    'any',
    (expected: unknown) => {
      return new Any(expected)
    },
  )

}
