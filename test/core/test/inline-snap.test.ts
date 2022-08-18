import MagicString from 'magic-string'
import { describe, expect, it } from 'vitest'
import { replaceInlineSnap } from '../../../packages/vitest/src/integrations/snapshot/port/inlineSnapshot'

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
      expect('foo').toMatchInlineSnapshot('\\"bar\\"')
      expect('foo').toMatchInlineSnapshot(\`
        \\"bar
        foo\\"
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
        expect('foo').toMatchInlineSnapshot('\\"bar\\"')
        expect('foo').toMatchInlineSnapshot(\`
          \\"bar
          foo\\"
        \`)
      "
    `)
  })
})
