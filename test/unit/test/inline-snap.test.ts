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
    replaceInlineSnap(code, s, 0, `
    {
      "bar": {
        "map2": Map {},
        "type": "object1",
      },
    }
  `)
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
      const code = 'expect({ foo: \'bar\' }).toMatchInlineSnapshot({ foo: expect.any(String) })'

      const s = new MagicString(code)
      replaceInlineSnap(code, s, 23, `
      {
        "foo": Any<String>,
      }
    `)

      expect(s.toString()).toMatchInlineSnapshot(`
        "expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) }, \`
          {
                  "foo": Any<String>,
                }
        \`)"
      `)
    })

    it('with snapshot', async () => {
      const code = 'expect({ foo: \'bar\' }).toMatchInlineSnapshot({ foo: expect.any(String) }, `{ }`)'

      const s = new MagicString(code)
      replaceInlineSnap(code, s, 23, `
      {
        "foo": Any<String>,
      }
    `)

      expect(s.toString()).toMatchInlineSnapshot(`
        "expect({ foo: 'bar' }).toMatchInlineSnapshot({ foo: expect.any(String) }, \`
          {
                  "foo": Any<String>,
                }
        \`)"
      `)
    })
  })
})
