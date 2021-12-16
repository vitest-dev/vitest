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

export class ObjectContaining extends AsymmetricMatcher<Record<string, unknown>> {
  constructor(sample: Record<string, unknown>, inverse = false) {
    super(sample, inverse);
  }

  getPrototype(obj: object) {
    if (Object.getPrototypeOf) {
      return Object.getPrototypeOf(obj);
    }

    if (obj.constructor.prototype == obj) {
      return null;
    }

    return obj.constructor.prototype;
  }

  hasProperty(obj: object | null, property: string): boolean {
    if (!obj) {
      return false;
    }

    if (Object.prototype.hasOwnProperty.call(obj, property)) {
      return true;
    }

    return this.hasProperty(this.getPrototype(obj), property);
  }

  asymmetricMatch(other: any) {
    if (typeof this.sample !== 'object') {
      throw new Error(
        `You must provide an object to ${this.toString()}, not '` +
          typeof this.sample +
          "'.",
      );
    }

    let result = true;

    for (const property in this.sample) {
      if (
        !this.hasProperty(other, property) ||
        !equals(this.sample[property], other[property])
      ) {
        result = false;
        break;
      }
    }

    return this.inverse ? !result : result;
  }

  toString() {
    return `Object${this.inverse ? 'Not' : ''}Containing`;
  }

  getExpectedType() {
    return 'object';
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
    'objectContaining',
    (expected: any) => {
      return new ObjectContaining(expected)
    },
  )

}
