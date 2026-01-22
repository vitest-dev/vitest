import type { TestTagDefinition } from '@vitest/runner'
import { createTagsFilter } from '@vitest/runner/utils'
import { describe, expect, test } from 'vitest'

function tags(...names: string[]): TestTagDefinition[] {
  return names.map(name => ({ name }))
}

describe('createTagsFilter', () => {
  describe('simple tag matching', () => {
    test('matches a single tag', () => {
      const filter = createTagsFilter(['foo'], tags('foo', 'bar'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(false)
      expect(filter(['foo', 'bar'])).toBe(true)
      expect(filter([])).toBe(false)
    })

    test('matches multiple expressions (AND between expressions)', () => {
      const filter = createTagsFilter(['foo', 'bar'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar'])).toBe(true)
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(false)
      expect(filter(['foo', 'bar', 'baz'])).toBe(true)
    })
  })

  describe('NOT operator', () => {
    test('negates with ! prefix', () => {
      const filter = createTagsFilter(['!foo'], tags('foo', 'bar'))
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(true)
      expect(filter(['foo', 'bar'])).toBe(false)
      expect(filter([])).toBe(true)
    })

    test('negates with "not" keyword', () => {
      const filter = createTagsFilter(['not foo'], tags('foo', 'bar'))
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(true)
      expect(filter(['foo', 'bar'])).toBe(false)
      expect(filter([])).toBe(true)
    })

    test('double negation', () => {
      const filter = createTagsFilter(['!!foo'], tags('foo', 'bar'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(false)
    })

    test('double negation with "not not"', () => {
      const filter = createTagsFilter(['not not foo'], tags('foo', 'bar'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(false)
    })
  })

  describe('AND operator', () => {
    test('matches with "and" keyword', () => {
      const filter = createTagsFilter(['foo and bar'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar'])).toBe(true)
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(false)
      expect(filter(['foo', 'bar', 'baz'])).toBe(true)
    })

    test('matches with && operator', () => {
      const filter = createTagsFilter(['foo && bar'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar'])).toBe(true)
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(false)
    })

    test('chained AND operators', () => {
      const filter = createTagsFilter(['foo and bar and baz'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar', 'baz'])).toBe(true)
      expect(filter(['foo', 'bar'])).toBe(false)
      expect(filter(['foo', 'baz'])).toBe(false)
    })

    test('chained && operators', () => {
      const filter = createTagsFilter(['foo && bar && baz'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar', 'baz'])).toBe(true)
      expect(filter(['foo', 'bar'])).toBe(false)
    })
  })

  describe('OR operator', () => {
    test('matches with "or" keyword', () => {
      const filter = createTagsFilter(['foo or bar'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(true)
      expect(filter(['baz'])).toBe(false)
      expect(filter(['foo', 'bar'])).toBe(true)
    })

    test('matches with || operator', () => {
      const filter = createTagsFilter(['foo || bar'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(true)
      expect(filter(['baz'])).toBe(false)
    })

    test('chained OR operators', () => {
      const filter = createTagsFilter(['foo or bar or baz'], tags('foo', 'bar', 'baz', 'qux'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(true)
      expect(filter(['baz'])).toBe(true)
      expect(filter(['qux'])).toBe(false)
    })

    test('chained || operators', () => {
      const filter = createTagsFilter(['foo || bar || baz'], tags('foo', 'bar', 'baz', 'qux'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(true)
      expect(filter(['baz'])).toBe(true)
      expect(filter(['qux'])).toBe(false)
    })
  })

  describe('operator precedence', () => {
    test('AND has higher precedence than OR', () => {
      const filter = createTagsFilter(['foo or bar and baz'], tags('foo', 'bar', 'baz'))
      // Parsed as: foo or (bar and baz)
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar', 'baz'])).toBe(true)
      expect(filter(['bar'])).toBe(false)
      expect(filter(['baz'])).toBe(false)
    })

    test('&& has higher precedence than ||', () => {
      const filter = createTagsFilter(['foo || bar && baz'], tags('foo', 'bar', 'baz'))
      // Parsed as: foo || (bar && baz)
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar', 'baz'])).toBe(true)
      expect(filter(['bar'])).toBe(false)
    })

    test('NOT has highest precedence', () => {
      const filter = createTagsFilter(['!foo and bar'], tags('foo', 'bar'))
      // Parsed as: (!foo) and bar
      expect(filter(['bar'])).toBe(true)
      expect(filter(['foo', 'bar'])).toBe(false)
      expect(filter(['foo'])).toBe(false)
    })
  })

  describe('parentheses', () => {
    test('overrides precedence with parentheses', () => {
      const filter = createTagsFilter(['(foo or bar) and baz'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'baz'])).toBe(true)
      expect(filter(['bar', 'baz'])).toBe(true)
      expect(filter(['foo'])).toBe(false)
      expect(filter(['baz'])).toBe(false)
    })

    test('nested parentheses', () => {
      const filter = createTagsFilter(['((foo or bar) and baz) or qux'], tags('foo', 'bar', 'baz', 'qux'))
      expect(filter(['foo', 'baz'])).toBe(true)
      expect(filter(['bar', 'baz'])).toBe(true)
      expect(filter(['qux'])).toBe(true)
      expect(filter(['foo'])).toBe(false)
      expect(filter(['baz'])).toBe(false)
    })

    test('negation with parentheses', () => {
      const filter = createTagsFilter(['!(foo or bar)'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(false)
      expect(filter(['baz'])).toBe(true)
      expect(filter([])).toBe(true)
    })

    test('complex expression with parentheses', () => {
      const filter = createTagsFilter(['(foo && bar) || (baz && !qux)'], tags('foo', 'bar', 'baz', 'qux'))
      expect(filter(['foo', 'bar'])).toBe(true)
      expect(filter(['baz'])).toBe(true)
      expect(filter(['baz', 'qux'])).toBe(false)
      expect(filter(['foo'])).toBe(false)
    })
  })

  describe('wildcard patterns', () => {
    test('matches with * wildcard', () => {
      const filter = createTagsFilter(['test*'], tags('test', 'test-unit', 'test-e2e', 'other'))
      expect(filter(['test-unit'])).toBe(true)
      expect(filter(['test-e2e'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('wildcard matches zero or more characters', () => {
      const filter = createTagsFilter(['test*'], tags('test', 'test-unit'))
      // * matches zero or more characters
      expect(filter(['test'])).toBe(true)
      expect(filter(['test-unit'])).toBe(true)
    })

    test('wildcard at start', () => {
      const filter = createTagsFilter(['*-unit'], tags('test-unit', 'e2e-unit', 'integration'))
      expect(filter(['test-unit'])).toBe(true)
      expect(filter(['e2e-unit'])).toBe(true)
      expect(filter(['integration'])).toBe(false)
    })

    test('wildcard in middle', () => {
      const filter = createTagsFilter(['test-*-fast'], tags('test-unit-fast', 'test-e2e-fast', 'test-slow'))
      expect(filter(['test-unit-fast'])).toBe(true)
      expect(filter(['test-e2e-fast'])).toBe(true)
      expect(filter(['test-slow'])).toBe(false)
    })

    test('multiple wildcards', () => {
      const filter = createTagsFilter(['*test*'], tags('unit-test-fast', 'test-e2e', 'other'))
      expect(filter(['unit-test-fast'])).toBe(true)
      expect(filter(['test-e2e'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('wildcard with negation', () => {
      const filter = createTagsFilter(['!test*'], tags('test-unit', 'other'))
      expect(filter(['test-unit'])).toBe(false)
      expect(filter(['other'])).toBe(true)
    })

    test('wildcard with AND', () => {
      const filter = createTagsFilter(['test* and fast'], tags('test-unit', 'fast', 'slow'))
      expect(filter(['test-unit', 'fast'])).toBe(true)
      expect(filter(['test-unit', 'slow'])).toBe(false)
      expect(filter(['fast'])).toBe(false)
    })

    test('wildcard with OR', () => {
      const filter = createTagsFilter(['test* or fast'], tags('test-unit', 'fast', 'slow'))
      expect(filter(['test-unit'])).toBe(true)
      expect(filter(['fast'])).toBe(true)
      expect(filter(['slow'])).toBe(false)
    })
  })

  describe('mixed operators', () => {
    test('mixing "and" and &&', () => {
      const filter = createTagsFilter(['foo and bar && baz'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar', 'baz'])).toBe(true)
      expect(filter(['foo', 'bar'])).toBe(false)
    })

    test('mixing "or" and ||', () => {
      const filter = createTagsFilter(['foo or bar || baz'], tags('foo', 'bar', 'baz', 'qux'))
      expect(filter(['foo'])).toBe(true)
      expect(filter(['bar'])).toBe(true)
      expect(filter(['baz'])).toBe(true)
      expect(filter(['qux'])).toBe(false)
    })

    test('mixing ! and "not"', () => {
      const filter = createTagsFilter(['!foo and not bar'], tags('foo', 'bar', 'baz'))
      expect(filter(['baz'])).toBe(true)
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(false)
    })
  })

  describe('case sensitivity', () => {
    test('operators are case-insensitive', () => {
      const filter = createTagsFilter(['foo AND bar OR baz'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar'])).toBe(true)
      expect(filter(['baz'])).toBe(true)
    })

    test('NOT is case-insensitive', () => {
      const filter = createTagsFilter(['NOT foo'], tags('foo', 'bar'))
      expect(filter(['foo'])).toBe(false)
      expect(filter(['bar'])).toBe(true)
    })

    test('tag names are case-sensitive', () => {
      const filter = createTagsFilter(['Foo'], tags('Foo', 'foo'))
      expect(filter(['Foo'])).toBe(true)
      expect(filter(['foo'])).toBe(false)
    })
  })

  describe('whitespace handling', () => {
    test('handles extra whitespace', () => {
      const filter = createTagsFilter(['  foo   and   bar  '], tags('foo', 'bar'))
      expect(filter(['foo', 'bar'])).toBe(true)
    })

    test('handles tabs', () => {
      const filter = createTagsFilter(['foo\tand\tbar'], tags('foo', 'bar'))
      expect(filter(['foo', 'bar'])).toBe(true)
    })

    test('handles no whitespace with && and ||', () => {
      const filter = createTagsFilter(['foo&&bar||baz'], tags('foo', 'bar', 'baz'))
      expect(filter(['foo', 'bar'])).toBe(true)
      expect(filter(['baz'])).toBe(true)
    })
  })

  describe('tags with special characters', () => {
    test('tags with hyphens', () => {
      const filter = createTagsFilter(['test-unit'], tags('test-unit', 'test-e2e'))
      expect(filter(['test-unit'])).toBe(true)
      expect(filter(['test-e2e'])).toBe(false)
    })

    test('tags with underscores', () => {
      const filter = createTagsFilter(['test_unit'], tags('test_unit', 'test_e2e'))
      expect(filter(['test_unit'])).toBe(true)
      expect(filter(['test_e2e'])).toBe(false)
    })

    test('tags with slashes', () => {
      const filter = createTagsFilter(['scope/tag'], tags('scope/tag', 'other'))
      expect(filter(['scope/tag'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('tags with dots', () => {
      const filter = createTagsFilter(['v1.0'], tags('v1.0', 'v2.0'))
      expect(filter(['v1.0'])).toBe(true)
      expect(filter(['v2.0'])).toBe(false)
    })

    test('tags with @ symbol and non-alphanumeric characters', () => {
      const filter = createTagsFilter(['@scope/tag'], tags('@scope/tag', '@other/tag'))
      expect(filter(['@scope/tag'])).toBe(true)
      expect(filter(['@other/tag'])).toBe(false)
    })

    test('tags with UTF-8 characters', () => {
      const filter = createTagsFilter(['测试'], tags('测试', '测试2', 'test'))
      expect(filter(['测试'])).toBe(true)
      expect(filter(['测试2'])).toBe(false)
      expect(filter(['test'])).toBe(false)
    })

    test('tags with @ followed by UTF-8 characters', () => {
      const filter = createTagsFilter(['@日本語'], tags('@日本語', '@中文', 'english'))
      expect(filter(['@日本語'])).toBe(true)
      expect(filter(['@中文'])).toBe(false)
      expect(filter(['english'])).toBe(false)
    })

    test('tags with mixed special characters and UTF-8', () => {
      const filter = createTagsFilter(['@tag-名前_v1.0'], tags('@tag-名前_v1.0', '@tag-other_v1.0'))
      expect(filter(['@tag-名前_v1.0'])).toBe(true)
      expect(filter(['@tag-other_v1.0'])).toBe(false)
    })

    test('tags with emoji characters', () => {
      const filter = createTagsFilter(['test-🚀'], tags('test-🚀', 'test-💚', 'test'))
      expect(filter(['test-🚀'])).toBe(true)
      expect(filter(['test-💚'])).toBe(false)
    })

    test('tags with special chars containing operator keywords', () => {
      const filter = createTagsFilter(['or@tag || and@test || not@feature'], tags('or@tag', 'and@test', 'not@feature', 'other'))
      expect(filter(['or@tag'])).toBe(true)
      expect(filter(['and@test'])).toBe(true)
      expect(filter(['not@feature'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('tags with UTF-8 chars containing operator keywords', () => {
      const filter = createTagsFilter(['or日本語 || and中文 || not한국어'], tags('or日本語', 'and中文', 'not한국어', 'english'))
      expect(filter(['or日本語'])).toBe(true)
      expect(filter(['and中文'])).toBe(true)
      expect(filter(['not한국어'])).toBe(true)
      expect(filter(['english'])).toBe(false)
    })

    test('operator keywords with @ and UTF-8 in complex expressions', () => {
      const filter = createTagsFilter(['(or@tag || and@test) && not@feature'], tags('or@tag', 'and@test', 'not@feature', 'other'))
      expect(filter(['or@tag', 'not@feature'])).toBe(true)
      expect(filter(['and@test', 'not@feature'])).toBe(true)
      expect(filter(['or@tag'])).toBe(false)
      expect(filter(['other'])).toBe(false)
    })
  })

  describe('edge cases', () => {
    test('empty test tags array', () => {
      const filter = createTagsFilter(['foo'], tags('foo'))
      expect(filter([])).toBe(false)
    })

    test('empty expressions array returns true for any tags', () => {
      const filter = createTagsFilter([], tags('foo'))
      expect(filter(['foo'])).toBe(true)
      expect(filter([])).toBe(true)
    })

    test('tag that looks like an operator but is not', () => {
      const filter = createTagsFilter(['android'], tags('android', 'ios'))
      expect(filter(['android'])).toBe(true)
      expect(filter(['ios'])).toBe(false)
    })

    test('tag that starts with "or" but is not OR', () => {
      const filter = createTagsFilter(['orange'], tags('orange', 'apple'))
      expect(filter(['orange'])).toBe(true)
      expect(filter(['apple'])).toBe(false)
    })

    test('tag that starts with "and" but is not AND', () => {
      const filter = createTagsFilter(['android'], tags('android', 'ios'))
      expect(filter(['android'])).toBe(true)
    })

    test('tag that starts with "not" but is not NOT', () => {
      const filter = createTagsFilter(['nothing'], tags('nothing', 'something'))
      expect(filter(['nothing'])).toBe(true)
      expect(filter(['something'])).toBe(false)
    })

    test('tag containing "and" in the middle', () => {
      const filter = createTagsFilter(['standalone'], tags('standalone', 'other'))
      expect(filter(['standalone'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('tag containing "or" in the middle', () => {
      const filter = createTagsFilter(['priority'], tags('priority', 'other'))
      expect(filter(['priority'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('tag containing "not" in the middle', () => {
      const filter = createTagsFilter(['annotation'], tags('annotation', 'other'))
      expect(filter(['annotation'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('tag ending with "and"', () => {
      const filter = createTagsFilter(['demand'], tags('demand', 'other'))
      expect(filter(['demand'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('tag ending with "or"', () => {
      const filter = createTagsFilter(['editor'], tags('editor', 'other'))
      expect(filter(['editor'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('tag ending with "not"', () => {
      const filter = createTagsFilter(['cannot'], tags('cannot', 'other'))
      expect(filter(['cannot'])).toBe(true)
      expect(filter(['other'])).toBe(false)
    })

    test('complex expression with tags containing operator substrings', () => {
      const filter = createTagsFilter(['android and editor or nothing'], tags('android', 'editor', 'nothing'))
      // Parsed as: android AND editor OR nothing
      expect(filter(['android', 'editor'])).toBe(true)
      expect(filter(['nothing'])).toBe(true)
      expect(filter(['android'])).toBe(false)
      expect(filter(['editor'])).toBe(false)
    })
  })

  describe('validation errors', () => {
    test('throws error for unknown tag', () => {
      expect(() => createTagsFilter(['unknown'], tags('foo', 'bar'))).toThrow(
        'The tag pattern "unknown" is not defined in the configuration',
      )
    })

    test('throws error for unknown tag in expression', () => {
      expect(() => createTagsFilter(['foo and unknown'], tags('foo', 'bar'))).toThrow(
        'The tag pattern "unknown" is not defined in the configuration',
      )
    })

    test('throws error when no tags defined', () => {
      expect(() => createTagsFilter(['foo'], [])).toThrow(
        'The Vitest config does\'t define any "tags"',
      )
    })

    test('throws error for wildcard pattern that matches nothing', () => {
      expect(() => createTagsFilter(['xyz*'], tags('foo', 'bar'))).toThrow(
        'The tag pattern "xyz*" is not defined in the configuration',
      )
    })
  })

  describe('parser errors', () => {
    test('throws error for unclosed parenthesis', () => {
      expect(() => createTagsFilter(['(foo and bar'], tags('foo', 'bar'))).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid tags expression: missing closing ")" in "(foo and bar"]`)
    })

    test('throws error for unexpected closing parenthesis', () => {
      expect(() => createTagsFilter(['foo and bar)'], tags('foo', 'bar'))).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid tags expression: unexpected ")" in "foo and bar)"]`)
    })

    test('throws error for empty parentheses', () => {
      expect(() => createTagsFilter(['()'], tags('foo'))).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid tags expression: unexpected ")" in "()"]`)
    })

    test('throws error for operator without operand', () => {
      expect(() => createTagsFilter(['foo and'], tags('foo', 'bar'))).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid tags expression: unexpected end of expression in "foo and"]`)
    })

    test('throws error for leading operator', () => {
      expect(() => createTagsFilter(['and foo'], tags('foo'))).toThrowErrorMatchingInlineSnapshot(`[Error: Invalid tags expression: unexpected "and" in "and foo"]`)
    })
  })

  describe('complex real-world scenarios', () => {
    test('filter slow tests but include critical', () => {
      const filter = createTagsFilter(['!slow or critical'], tags('slow', 'fast', 'critical'))
      expect(filter(['fast'])).toBe(true)
      expect(filter(['slow'])).toBe(false)
      expect(filter(['slow', 'critical'])).toBe(true)
    })

    test('run only unit tests that are not flaky', () => {
      const filter = createTagsFilter(['unit && !flaky'], tags('unit', 'e2e', 'flaky'))
      expect(filter(['unit'])).toBe(true)
      expect(filter(['unit', 'flaky'])).toBe(false)
      expect(filter(['e2e'])).toBe(false)
    })

    test('run browser tests for chrome or firefox but not edge', () => {
      const filter = createTagsFilter(['browser && (chrome || firefox) && !edge'], tags('browser', 'chrome', 'firefox', 'edge'))
      expect(filter(['browser', 'chrome'])).toBe(true)
      expect(filter(['browser', 'firefox'])).toBe(true)
      expect(filter(['browser', 'edge'])).toBe(false)
      expect(filter(['chrome'])).toBe(false)
    })

    test('multiple filter expressions act as AND', () => {
      const filter = createTagsFilter(['unit || e2e', '!slow'], tags('unit', 'e2e', 'slow', 'fast'))
      expect(filter(['unit'])).toBe(true)
      expect(filter(['e2e'])).toBe(true)
      expect(filter(['unit', 'slow'])).toBe(false)
      expect(filter(['e2e', 'slow'])).toBe(false)
      expect(filter(['fast'])).toBe(false)
    })
  })
})
