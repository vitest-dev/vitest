import { getCallLastIndex } from '@vitest/utils/helpers'
import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { replaceInlineSnap } from '../../../packages/snapshot/src/port/inlineSnapshot'

describe('inline-snap utils', () => {
  it('replaceInlineSnap', async () => {
    const code = `
expect('foo').toMatchInlineSnapshot('"foo"')
expect('foo').toMatchInlineSnapshot(\`{
  "foo": \\\`\\\`,
}\`)
`
    const s = new MagicString(code)
    replaceInlineSnap(code, s, 3, '"bar"')
    replaceInlineSnap(code, s, 40, '"bar\nfoo"')
    expect(s.toString()).toMatchInlineSnapshot(`
      "
      expect('foo').toMatchInlineSnapshot(\`"bar"\`)
      expect('foo').toMatchInlineSnapshot(\`
        "bar
        foo"
      \`)
      "
    `)
  })

  it('replaceInlineSnap with indentation', async () => {
    const indent = '  '
    const code = `
${indent}expect('foo').toMatchInlineSnapshot('"foo"')
${indent}expect('foo').toMatchInlineSnapshot(\`{
${indent}  "foo": \\\`\\\`,
${indent}}\`)
`
    const s = new MagicString(code)
    replaceInlineSnap(code, s, 3, '"bar"')
    replaceInlineSnap(code, s, 60, '"bar\nfoo"')
    expect(s.toString()).toMatchInlineSnapshot(`
      "
        expect('foo').toMatchInlineSnapshot(\`"bar"\`)
        expect('foo').toMatchInlineSnapshot(\`
          "bar
          foo"
        \`)
      "
    `)
  })

  it('replaceInlineSnap(string) with block comment(in same line)', async () => {
    const code = `
  expect('foo').toMatchInlineSnapshot(/* comment1 */'"foo"')
  `
    const s = new MagicString(code)
    replaceInlineSnap(code, s, 0, '"bar"')
    expect(s.toString()).toMatchInlineSnapshot(`
      "
        expect('foo').toMatchInlineSnapshot(/* comment1 */\`"bar"\`)
        "
    `)
  })

  it('replaceInlineSnap(string) with block comment(new line)', async () => {
    const code = `
  expect('foo').toMatchInlineSnapshot(
    /* comment1
       comment2
    */

    '"foo"')
  `
    const s = new MagicString(code)
    replaceInlineSnap(code, s, 0, '"bar"')
    expect(s.toString()).toMatchInlineSnapshot(`
      "
        expect('foo').toMatchInlineSnapshot(
          /* comment1
             comment2
          */

          \`"bar"\`)
        "
    `)
  })

  it('replaceInlineSnap(string) with single line comment', async () => {
    const code = `
  expect('foo').toMatchInlineSnapshot(
    // comment1
    // comment2
    '"foo"')
  `
    const s = new MagicString(code)
    replaceInlineSnap(code, s, 0, '"bar"')
    expect(s.toString()).toMatchInlineSnapshot(`
      "
        expect('foo').toMatchInlineSnapshot(
          // comment1
          // comment2
          \`"bar"\`)
        "
    `)
  })

  it('replaceInlineSnap(object) comments', async () => {
    const code = `
  expect({}).toMatchInlineSnapshot(
    // comment1
    // comment2
    /*
      comment3
      comment4
    */
    \`{
        "foo": {
          "map": Map {},
          "type": "object",
        },
      }\`)
  `
    const s = new MagicString(code)
    replaceInlineSnap(
      code,
      s,
      0,
      `
    {
      "bar": {
        "map2": Map {},
        "type": "object1",
      },
    }
  `,
    )
    expect(s.toString()).toMatchInlineSnapshot(`
      "
        expect({}).toMatchInlineSnapshot(
          // comment1
          // comment2
          /*
            comment3
            comment4
          */
          \`
        {
              "bar": {
                "map2": Map {},
                "type": "object1",
              },
            }
      \`)
        "
    `)
  })

  describe('replaceObjectSnap()', () => {
    it('without snapshot', async () => {
      const code = "expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) })"

      const s = new MagicString(code)
      replaceInlineSnap(
        code,
        s,
        23,
        `
      {
        "foo": Any<String>,
      }
    `,
      )

      expect(s.toString()).toMatchInlineSnapshot(`
        "expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) }, \`
          {
                  "foo": Any<String>,
                }
        \`)"
      `)
    })

    it('with snapshot', async () => {
      const code =
        "expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) }, `{ }`)"

      const s = new MagicString(code)
      replaceInlineSnap(
        code,
        s,
        23,
        `
      {
        "foo": Any<String>,
      }
    `,
      )

      expect(s.toString()).toMatchInlineSnapshot(`
        "expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) }, \`
          {
                  "foo": Any<String>,
                }
        \`)"
      `)
    })
  })

  it('replaceInlineSnap with trailing escaped backslashes', () => {
    const code = [
      'expect(fn()).toMatchInlineSnapshot(`C:\\\\`)',
      'expect(after()).toBe(true)',
    ].join('\n')
    const s = new MagicString(code)
    expect(replaceInlineSnap(code, s, 0, '"D:\\\\"')).toBe(true)
    expect(s.toString()).toBe([
      'expect(fn()).toMatchInlineSnapshot(`"D:\\\\\\\\"`)',
      'expect(after()).toBe(true)',
    ].join('\n'))
  })

  it('replaceInlineSnap with only escaped backslash', () => {
    const code = 'expect(fn()).toMatchInlineSnapshot(`\\\\`)'
    const s = new MagicString(code)
    expect(replaceInlineSnap(code, s, 0, '"x"')).toBe(true)
    expect(s.toString()).toBe('expect(fn()).toMatchInlineSnapshot(`"x"`)')
  })

  it('getCallLastIndex with trailing escaped backslashes', () => {
    const code = 'toMatchInlineSnapshot(`C:\\\\`)\nexpect(after()).toBe(true)'
    expect(getCallLastIndex(code)).toBe('toMatchInlineSnapshot(`C:\\\\`)'.length - 1)

    const escapedQuote = 'toMatchInlineSnapshot(`a\\`)`)'
    expect(getCallLastIndex(escapedQuote)).toBe(escapedQuote.length - 1)
  })
})
