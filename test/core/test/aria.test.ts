// @vitest-environment happy-dom

/**
 * Tests for the ARIA snapshot pipeline.
 *
 * Based on Playwright v1.58.2 tests:
 *   https://github.com/microsoft/playwright/blob/v1.58.2/tests/page/to-match-aria-snapshot.spec.ts
 *   https://github.com/microsoft/playwright/blob/v1.58.2/tests/page/page-aria-snapshot.spec.ts
 */

import type { AriaNode, AriaTemplateRoleNode } from '@vitest/snapshot/aria'
import { captureAriaTree, matchAriaTree, parseAriaTemplate, renderAriaTree } from '@vitest/snapshot/aria'
import { describe, expect, test } from 'vitest'

function capture(html: string) {
  document.body.innerHTML = html
  return captureAriaTree(document.body)
}

function render(html: string) {
  return renderAriaTree(capture(html))
}

function match(html: string, template: string) {
  const r = matchAriaTree(capture(html), parseAriaTemplate(template))
  return {
    pass: r.pass,
    actual: `\n${r.actual}\n`,
    expected: `\n${r.expected}\n`,
    mergedExpected: `\n${r.mergedExpected}\n`,
  }
}

// ---------------------------------------------------------------------------
// capture
// ---------------------------------------------------------------------------

describe('captureAriaTree', () => {
  test('heading', () => {
    const tree = capture('<h1>Hello</h1>')
    expect(tree.children).toMatchInlineSnapshot(`
      [
        {
          "children": [
            "Hello",
          ],
          "level": 1,
          "name": "",
          "role": "heading",
        },
      ]
    `)
  })

  test('link with href', () => {
    const tree = capture('<a href="/foo">Click</a>')
    expect(tree.children).toMatchInlineSnapshot(`
      [
        {
          "children": [
            "Click",
          ],
          "name": "",
          "role": "link",
          "url": "/foo",
        },
      ]
    `)
  })

  test('anchor without href has no role', () => {
    const tree = capture('<a>Not a link</a>')
    expect(tree.children).toMatchInlineSnapshot(`
      [
        "Not a link",
      ]
    `)
  })

  test('aria-label sets name', () => {
    const tree = capture('<button aria-label="Close">X</button>')
    const btn = tree.children[0] as any
    expect(btn.role).toBe('button')
    expect(btn.name).toBe('Close')
  })

  test('explicit role overrides implicit', () => {
    const tree = capture('<div role="alert">Warning!</div>')
    const node = tree.children[0] as any
    expect(node.role).toBe('alert')
  })

  test('aria-hidden elements are excluded', () => {
    const tree = capture('<div aria-hidden="true">Hidden</div><p>Visible</p>')
    expect(tree.children).toMatchInlineSnapshot(`
      [
        {
          "children": [
            "Visible",
          ],
          "name": "",
          "role": "paragraph",
        },
      ]
    `)
  })

  test('checkbox states', () => {
    const tree = capture(`
      <div role="checkbox" aria-checked="true" aria-label="A"></div>
      <div role="checkbox" aria-checked="false" aria-label="B"></div>
      <div role="checkbox" aria-checked="mixed" aria-label="C"></div>
    `)
    const [a, b, c] = tree.children as any[]
    expect(a.checked).toBe(true)
    expect(b.checked).toBe(false)
    expect(c.checked).toBe('mixed')
  })

  test('nested list structure', () => {
    const tree = capture('<ul><li>One</li><li>Two</li></ul>')
    const list = tree.children[0] as any
    expect(list.role).toBe('list')
    expect(list.children).toHaveLength(2)
    expect(list.children[0].role).toBe('listitem')
  })

  test('label for input', () => {
    const tree = capture('<label for="x">Name</label><input id="x" type="text" />')
    const input = tree.children.find((c: any) => typeof c !== 'string' && c.role === 'textbox') as any
    expect(input.name).toBe('Name')
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "check aria-hidden text"
  test('aria-hidden nested children excluded', () => {
    const tree = capture('<p><span>hello</span><span aria-hidden="true">world</span></p>')
    const p = tree.children[0] as AriaNode
    expect(p.role).toBe('paragraph')
    expect(p.children).toEqual(['hello'])
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should ignore presentation and none roles"
  // happy-dom strips trailing whitespace from text nodes during innerHTML parsing,
  // so inter-element spacing is lost. Verified logic works: presentation/none roles
  // are correctly skipped in getRole() and children are promoted.
  test.skip('role="presentation" and role="none" promote children', () => {
    const tree = capture('<ul><li role="presentation">hello</li><li role="none">world</li></ul>')
    const list = tree.children[0] as AriaNode
    expect(list.role).toBe('list')
    expect(list.children).toEqual(['hello world'])
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should concatenate span text"
  // happy-dom strips trailing whitespace from text nodes during innerHTML parsing
  test.skip('concatenates inline text across spans', () => {
    const tree = capture('<span>One</span> <span>Two</span> <span>Three</span>')
    expect(tree.children).toEqual(['One Two Three'])
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should concatenate div text with spaces"
  // happy-dom strips trailing whitespace from text nodes during innerHTML parsing
  test.skip('concatenates div text', () => {
    const tree = capture('<div>One</div><div>Two</div><div>Three</div>')
    expect(tree.children).toEqual(['One Two Three'])
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should support multiline text"
  test('multiline text collapses whitespace', () => {
    const tree = capture('<p>Line 1\n      Line 2\n      Line 3</p>')
    const p = tree.children[0] as AriaNode
    expect(p.children).toEqual(['Line 1 Line 2 Line 3'])
  })

  // -- Gap: hidden HTML attribute
  test('hidden attribute excludes element', () => {
    const tree = capture('<div hidden>Hidden</div><p>Visible</p>')
    expect(tree.children).toHaveLength(1)
    expect((tree.children[0] as AriaNode).role).toBe('paragraph')
  })

  // -- Gap: style/script/noscript/template tags
  test('style, script, noscript, template tags are excluded', () => {
    const tree = capture('<style>.x{}</style><script>var x</script><noscript>No JS</noscript><template><p>T</p></template><p>Visible</p>')
    expect(tree.children).toHaveLength(1)
    expect((tree.children[0] as AriaNode).role).toBe('paragraph')
  })

  // -- Gap: aria-labelledby
  test('aria-labelledby resolves name from referenced elements', () => {
    const tree = capture('<span id="a">Hello</span><span id="b">World</span><button aria-labelledby="a b">X</button>')
    const btn = tree.children.find((c: any) => typeof c !== 'string' && c.role === 'button') as AriaNode
    expect(btn.name).toBe('Hello World')
  })

  // -- Gap: IMG alt text
  test('img alt text as accessible name', () => {
    const tree = capture('<img alt="Logo">')
    const img = tree.children[0] as AriaNode
    expect(img.role).toBe('img')
    expect(img.name).toBe('Logo')
  })

  // -- Gap: IMG empty alt -> presentation (skipped)
  test('img with empty alt has presentation role (children promoted)', () => {
    const tree = capture('<img alt="">')
    // Empty alt = presentation role, which is skipped (no node emitted)
    expect(tree.children).toHaveLength(0)
  })

  // -- Gap: INPUT type variants
  test('input type="radio" has radio role', () => {
    const tree = capture('<input type="radio">')
    expect((tree.children[0] as AriaNode).role).toBe('radio')
  })

  test('input type="submit" has button role', () => {
    const tree = capture('<input type="submit">')
    expect((tree.children[0] as AriaNode).role).toBe('button')
  })

  test('input type="reset" has button role', () => {
    const tree = capture('<input type="reset">')
    expect((tree.children[0] as AriaNode).role).toBe('button')
  })

  test('input type="image" has button role', () => {
    const tree = capture('<input type="image">')
    expect((tree.children[0] as AriaNode).role).toBe('button')
  })

  test('input type="range" has slider role', () => {
    const tree = capture('<input type="range">')
    expect((tree.children[0] as AriaNode).role).toBe('slider')
  })

  test('input type="search" has searchbox role', () => {
    const tree = capture('<input type="search">')
    expect((tree.children[0] as AriaNode).role).toBe('searchbox')
  })

  test('input type="checkbox" has checkbox role', () => {
    const tree = capture('<input type="checkbox">')
    expect((tree.children[0] as AriaNode).role).toBe('checkbox')
  })

  test('input with no type defaults to textbox', () => {
    const tree = capture('<input>')
    expect((tree.children[0] as AriaNode).role).toBe('textbox')
  })

  // -- Gap: SELECT -> combobox
  test('select has combobox role', () => {
    const tree = capture('<select><option>A</option></select>')
    expect((tree.children[0] as AriaNode).role).toBe('combobox')
  })

  // -- Gap: TEXTAREA -> textbox
  test('textarea has textbox role', () => {
    const tree = capture('<textarea></textarea>')
    expect((tree.children[0] as AriaNode).role).toBe('textbox')
  })

  // -- Gap: SECTION with/without aria-label
  test('section with aria-label has region role', () => {
    const tree = capture('<section aria-label="S">content</section>')
    expect((tree.children[0] as AriaNode).role).toBe('region')
  })

  test('section without aria-label has no role', () => {
    const tree = capture('<section>content</section>')
    expect(tree.children).toEqual(['content'])
  })

  // -- Gap: table elements
  test('table structure roles', () => {
    const tree = capture(`
      <table>
        <thead><tr><th>H</th></tr></thead>
        <tbody><tr><td>D</td></tr></tbody>
        <tfoot><tr><td>F</td></tr></tfoot>
      </table>
    `)
    const table = tree.children[0] as AriaNode
    expect(table.role).toBe('table')
    const [thead, tbody, tfoot] = table.children as AriaNode[]
    expect(thead.role).toBe('rowgroup')
    expect(tbody.role).toBe('rowgroup')
    expect(tfoot.role).toBe('rowgroup')
    const headerRow = thead.children[0] as AriaNode
    expect(headerRow.role).toBe('row')
    expect((headerRow.children[0] as AriaNode).role).toBe('columnheader')
    const bodyRow = tbody.children[0] as AriaNode
    expect((bodyRow.children[0] as AriaNode).role).toBe('cell')
  })

  // -- Gap: other implicit roles
  test('other implicit roles', () => {
    expect((capture('<article>x</article>').children[0] as AriaNode).role).toBe('article')
    expect((capture('<aside>x</aside>').children[0] as AriaNode).role).toBe('complementary')
    expect((capture('<dialog open>x</dialog>').children[0] as AriaNode).role).toBe('dialog')
    expect((capture('<fieldset><legend>L</legend></fieldset>').children[0] as AriaNode).role).toBe('group')
    expect((capture('<footer>x</footer>').children[0] as AriaNode).role).toBe('contentinfo')
    expect((capture('<form>x</form>').children[0] as AriaNode).role).toBe('form')
    expect((capture('<header>x</header>').children[0] as AriaNode).role).toBe('banner')
    expect((capture('<hr>').children[0] as AriaNode).role).toBe('separator')
    expect((capture('<main>x</main>').children[0] as AriaNode).role).toBe('main')
    expect((capture('<nav>x</nav>').children[0] as AriaNode).role).toBe('navigation')
    expect((capture('<ol><li>x</li></ol>').children[0] as AriaNode).role).toBe('list')
    expect((capture('<progress></progress>').children[0] as AriaNode).role).toBe('progressbar')
  })

  // -- Gap: explicit role with spaces (first token)
  test('explicit role with spaces takes first token', () => {
    const tree = capture('<div role="alert dialog">content</div>')
    expect((tree.children[0] as AriaNode).role).toBe('alert')
  })

  // -- Gap: name dedup
  test('sole child text matching name is deduplicated', () => {
    const tree = capture('<button aria-label="Click">Click</button>')
    const btn = tree.children[0] as AriaNode
    expect(btn.name).toBe('Click')
    expect(btn.children).toEqual([])
  })

  // -- Gap: aria-disabled, aria-expanded, aria-pressed, aria-selected capture
  test('aria-disabled captured', () => {
    const tree = capture('<button aria-disabled="true">X</button>')
    expect((tree.children[0] as AriaNode).disabled).toBe(true)
  })

  test('aria-expanded captured', () => {
    const tree = capture('<button aria-expanded="true">X</button>')
    expect((tree.children[0] as AriaNode).expanded).toBe(true)
  })

  test('aria-expanded=false captured', () => {
    const tree = capture('<button aria-expanded="false">X</button>')
    expect((tree.children[0] as AriaNode).expanded).toBe(false)
  })

  test('aria-pressed captured', () => {
    const tree = capture('<button aria-pressed="true">X</button>')
    expect((tree.children[0] as AriaNode).pressed).toBe(true)
  })

  test('aria-pressed=mixed captured', () => {
    const tree = capture('<button aria-pressed="mixed">X</button>')
    expect((tree.children[0] as AriaNode).pressed).toBe('mixed')
  })

  test('aria-selected captured', () => {
    const tree = capture('<table><tr aria-selected="true"><td>X</td></tr></table>')
    const table = tree.children[0] as AriaNode
    const rowgroup = table.children[0] as AriaNode
    const row = rowgroup.children[0] as AriaNode
    expect(row.selected).toBe(true)
  })

  // -- Gap: heading levels h2-h6
  test('heading levels h2 through h6', () => {
    expect((capture('<h2>x</h2>').children[0] as AriaNode).level).toBe(2)
    expect((capture('<h3>x</h3>').children[0] as AriaNode).level).toBe(3)
    expect((capture('<h4>x</h4>').children[0] as AriaNode).level).toBe(4)
    expect((capture('<h5>x</h5>').children[0] as AriaNode).level).toBe(5)
    expect((capture('<h6>x</h6>').children[0] as AriaNode).level).toBe(6)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should treat input value as text in templates"
  test('input value as text content', () => {
    const tree = capture('<input value="hello world">')
    const input = tree.children[0] as AriaNode
    expect(input.children).toEqual(['hello world'])
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should treat input value as text in templates"
  test('checkbox and radio do not capture value as text', () => {
    const tree = capture('<input type="checkbox" checked><input type="radio" checked>')
    const [cb, radio] = tree.children as AriaNode[]
    expect(cb.children).toEqual([])
    expect(radio.children).toEqual([])
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should not report textarea textContent"
  test('textarea value tracking', () => {
    const tree = capture('<textarea>Before</textarea>')
    const input = tree.children[0] as AriaNode
    expect(input.children).toEqual(['Before'])
  })

  // -- /placeholder: pseudo-attribute for inputs
  // Ported from Playwright: page-aria-snapshot.spec.ts "should snapshot placeholder"
  test('input captures placeholder', () => {
    const tree = capture('<input placeholder="Enter name">')
    const input = tree.children[0] as AriaNode
    expect(input.name).toBe('')
    expect(input.placeholder).toBe('Enter name')
  })

  test('placeholder not captured when same as name', () => {
    // When placeholder is used as the accessible name (via happy-dom/browser),
    // we don't duplicate it. Our code checks placeholder !== name.
    const tree = capture('<input placeholder="Name" aria-label="Name">')
    const input = tree.children[0] as AriaNode
    expect(input.name).toBe('Name')
    expect(input.placeholder).toBeUndefined()
  })

  // -- Not yet implemented: CSS visibility:hidden checks
  // Playwright: page-aria-snapshot.spec.ts "should not show visible children of hidden elements"
  test.skip('CSS visibility:hidden excludes element', () => {
    // We only check aria-hidden and hidden attr, not CSS visibility
  })

  // -- Not yet implemented: Shadow DOM / slots
  // Playwright: page-aria-snapshot.spec.ts "should work with slots"
  test.skip('shadow DOM slots', () => {
    // Shadow DOM / slots not yet implemented
  })

  // -- Not yet implemented: CSS pseudo-elements
  // Playwright: page-aria-snapshot.spec.ts "should include pseudo in text"
  test.skip('CSS pseudo-elements (::before, ::after) text', () => {
    // CSS pseudo-elements not yet implemented
  })

  // -- Not yet implemented: aria-owns
  // Playwright: page-aria-snapshot.spec.ts "should respect aria-owns"
  test.skip('aria-owns', () => {
    // aria-owns support not yet implemented
  })
})

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------

describe('renderAriaTree', () => {
  test('heading with level', () => {
    expect(render('<h1>Hello World</h1>')).toMatchInlineSnapshot(`"- heading [level=1]: Hello World"`)
  })

  test('nav with nested list', () => {
    expect(render(`
      <nav aria-label="Main">
        <ul>
          <li><a href="/a">A</a></li>
          <li><a href="/b">B</a></li>
        </ul>
      </nav>
    `)).toMatchInlineSnapshot(`
      "- navigation "Main":
        - list:
          - listitem:
            - link:
              - text: A
              - /url: /a
          - listitem:
            - link:
              - text: B
              - /url: /b"
    `)
  })

  test('checkbox attributes', () => {
    expect(render(`
      <div role="checkbox" aria-checked="true" aria-label="Accept"></div>
      <div role="checkbox" aria-checked="mixed" aria-label="All"></div>
    `)).toMatchInlineSnapshot(`
      "- checkbox "Accept" [checked]
      - checkbox "All" [checked=mixed]"
    `)
  })

  test('form with inputs', () => {
    expect(render(`
      <form>
        <label for="u">User</label>
        <input id="u" type="text" />
        <button type="submit">Go</button>
      </form>
    `)).toMatchInlineSnapshot(`
      "- form:
        - text: User
        - textbox "User"
        - button: Go"
    `)
  })

  // -- Gap: all ARIA state attributes in rendering
  test('disabled attribute renders', () => {
    expect(render('<button aria-disabled="true">X</button>')).toBe('- button [disabled]: X')
  })

  test('expanded attribute renders', () => {
    expect(render('<button aria-expanded="true">X</button>')).toBe('- button [expanded]: X')
  })

  test('expanded=false attribute renders', () => {
    expect(render('<button aria-expanded="false">X</button>')).toBe('- button [expanded=false]: X')
  })

  test('pressed attribute renders', () => {
    expect(render('<button aria-pressed="true">X</button>')).toBe('- button [pressed]: X')
  })

  test('pressed=mixed attribute renders', () => {
    expect(render('<button aria-pressed="mixed">X</button>')).toBe('- button [pressed=mixed]: X')
  })

  test('selected attribute renders', () => {
    expect(render('<div role="option" aria-selected="true">X</div>')).toBe('- option [selected]: X')
  })

  // -- Gap: leaf node (no children, no colon)
  test('leaf node with no children', () => {
    expect(render('<button aria-label="X"></button>')).toBe('- button "X"')
  })

  // -- Gap: fragment with top-level text
  test('fragment with text and element children', () => {
    expect(render('Hello <p>World</p>')).toBe('- text: Hello\n- paragraph: World')
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should concatenate span text"
  // happy-dom strips trailing whitespace from text nodes during innerHTML parsing
  test.skip('whitespace normalization across spans', () => {
    expect(render('<span>One</span> <span>Two</span> <span>Three</span>')).toBe('- text: One Two Three')
  })

  // -- /url: renders as pseudo-child
  test('link url renders as pseudo-child', () => {
    expect(render('<a href="/foo">Click</a>')).toBe('- link:\n  - text: Click\n  - /url: /foo')
  })

  test('link url with no text children', () => {
    expect(render('<a href="/foo" aria-label="Go"></a>')).toBe('- link "Go":\n  - /url: /foo')
  })

  // -- /placeholder: renders as pseudo-child
  test('input placeholder renders as pseudo-child', () => {
    expect(render('<input placeholder="Enter name">')).toBe('- textbox:\n  - /placeholder: Enter name')
  })

  // -- Not yet implemented: YAML escaping
  // Playwright: page-aria-snapshot.spec.ts "should escape yaml text in text nodes", "should escape special yaml characters/values"
  test.skip('YAML escaping of special characters', () => {
    // Our simplified parser does not handle YAML escaping
  })
})

// ---------------------------------------------------------------------------
// parseAriaTemplate
// ---------------------------------------------------------------------------

describe('parseAriaTemplate', () => {
  test('simple role', () => {
    const t = parseAriaTemplate('- button')
    expect(t.children).toMatchInlineSnapshot(`
      [
        {
          "children": [],
          "kind": "role",
          "role": "button",
        },
      ]
    `)
  })

  test('role with quoted name', () => {
    const t = parseAriaTemplate('- button "Submit"')
    expect(t.children![0]).toMatchObject({ role: 'button', name: 'Submit' })
  })

  test('role with regex name', () => {
    const t = parseAriaTemplate('- heading /Welcome \\d+/')
    const child = t.children![0] as any
    expect(child.name).toBeInstanceOf(RegExp)
    expect(child.name.test('Welcome 42')).toBe(true)
    expect(child.name.test('Goodbye')).toBe(false)
  })

  test('role with attributes', () => {
    const t = parseAriaTemplate('- checkbox "Accept" [checked] [disabled]')
    expect(t.children![0]).toMatchObject({ role: 'checkbox', name: 'Accept', checked: true, disabled: true })
  })

  test('heading with level', () => {
    const t = parseAriaTemplate('- heading [level=2]')
    expect(t.children![0]).toMatchObject({ role: 'heading', level: 2 })
  })

  test('inline text child', () => {
    const t = parseAriaTemplate('- button: Click me')
    const btn = t.children![0] as any
    expect(btn.children).toHaveLength(1)
    expect(btn.children[0]).toEqual({ kind: 'text', text: 'Click me' })
  })

  test('inline regex text child', () => {
    const t = parseAriaTemplate('- paragraph: /item \\d+/')
    const p = t.children![0] as any
    expect(p.children[0].text).toBeInstanceOf(RegExp)
  })

  test('nested children', () => {
    const t = parseAriaTemplate(`
      - list:
        - listitem:
          - link: Home
        - listitem:
          - link: About
    `)
    const list = t.children![0] as any
    expect(list.role).toBe('list')
    expect(list.children).toHaveLength(2)
    expect(list.children[0].children[0].children[0].text).toBe('Home')
  })

  test('text node', () => {
    const t = parseAriaTemplate('- text: hello world')
    expect(t.children![0]).toEqual({ kind: 'text', text: 'hello world' })
  })

  // -- Gap: expanded attribute parsing
  test('expanded attribute', () => {
    const t = parseAriaTemplate('- button [expanded]')
    expect((t.children![0] as AriaTemplateRoleNode).expanded).toBe(true)
  })

  test('expanded=false attribute', () => {
    const t = parseAriaTemplate('- button [expanded=false]')
    expect((t.children![0] as AriaTemplateRoleNode).expanded).toBe(false)
  })

  // -- Gap: pressed attribute parsing
  test('pressed attribute', () => {
    const t = parseAriaTemplate('- button [pressed]')
    expect((t.children![0] as AriaTemplateRoleNode).pressed).toBe(true)
  })

  test('pressed=mixed attribute', () => {
    const t = parseAriaTemplate('- button [pressed=mixed]')
    expect((t.children![0] as AriaTemplateRoleNode).pressed).toBe('mixed')
  })

  // -- Gap: selected attribute parsing
  test('selected attribute', () => {
    const t = parseAriaTemplate('- option [selected]')
    expect((t.children![0] as AriaTemplateRoleNode).selected).toBe(true)
  })

  // -- Gap: checked=mixed attribute parsing
  test('checked=mixed attribute', () => {
    const t = parseAriaTemplate('- checkbox [checked=mixed]')
    expect((t.children![0] as AriaTemplateRoleNode).checked).toBe('mixed')
  })

  // -- Gap: regex text node
  test('text node with regex', () => {
    const t = parseAriaTemplate('- text: /hello \\d+/')
    const node = t.children![0] as any
    expect(node.kind).toBe('text')
    expect(node.text).toBeInstanceOf(RegExp)
    expect(node.text.test('hello 42')).toBe(true)
  })

  // -- Gap: empty lines and non-list lines skipped
  test('empty lines and non-list lines are skipped', () => {
    const t = parseAriaTemplate(`

      - button

      not a list item
      - link
    `)
    expect(t.children).toHaveLength(2)
    expect((t.children![0] as AriaTemplateRoleNode).role).toBe('button')
    expect((t.children![1] as AriaTemplateRoleNode).role).toBe('link')
  })

  // -- Gap: error on invalid entry
  test('throws on invalid role entry', () => {
    expect(() => parseAriaTemplate('- !@#')).toThrow('Cannot parse aria template entry')
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "checked attribute" [checked=false]
  test('[checked=false] explicit false syntax', () => {
    const t = parseAriaTemplate('- checkbox [checked=false]')
    expect((t.children![0] as AriaTemplateRoleNode).checked).toBe(false)
  })

  test('[disabled=false] explicit false syntax', () => {
    const t = parseAriaTemplate('- button [disabled=false]')
    expect((t.children![0] as AriaTemplateRoleNode).disabled).toBe(false)
  })

  test('[pressed=false] explicit false syntax', () => {
    const t = parseAriaTemplate('- button [pressed=false]')
    expect((t.children![0] as AriaTemplateRoleNode).pressed).toBe(false)
  })

  test('[selected=false] explicit false syntax', () => {
    const t = parseAriaTemplate('- option [selected=false]')
    expect((t.children![0] as AriaTemplateRoleNode).selected).toBe(false)
  })

  // -- /url: and /placeholder: pseudo-children in templates
  test('/url: pseudo-child parses as string', () => {
    const t = parseAriaTemplate('- link:\n  - /url: /foo')
    expect((t.children![0] as AriaTemplateRoleNode).url).toBe('/foo')
  })

  test('/url: pseudo-child parses as regex', () => {
    const t = parseAriaTemplate('- link:\n  - /url: /.*example.com/')
    expect((t.children![0] as AriaTemplateRoleNode).url).toBeInstanceOf(RegExp)
  })

  test('/placeholder: pseudo-child parses', () => {
    const t = parseAriaTemplate('- textbox:\n  - /placeholder: Enter name')
    expect((t.children![0] as AriaTemplateRoleNode).placeholder).toBe('Enter name')
  })

  // -- Not yet implemented: YAML block scalars
  // Playwright: page-aria-snapshot.spec.ts "should support multiline text" (| syntax)
  test.skip('YAML block scalar (| multiline)', () => {
    // YAML block scalar syntax not yet implemented
  })

  // -- Not yet implemented: parse error reporting with source location
  // Playwright: to-match-aria-snapshot.spec.ts "should report error in YAML keys"
  test.skip('parse error with source location', () => {
    // Our parser does not report error location like Playwright does
  })

  // -- Not yet implemented: YAML quoting/escaping
  // Playwright: to-match-aria-snapshot.spec.ts "should unpack escaped names"
  test.skip('YAML quoting/escaping in names', () => {
    // Our simplified parser does not handle YAML quoting
  })

  // -- Not yet implemented: /children: equal|deep-equal|contain directives
  // Playwright: to-match-aria-snapshot.spec.ts "should detect unexpected children: equal"
  test.skip('/children: equal|deep-equal|contain directives', () => {
    // Containment mode directives not yet implemented
  })
})

// ---------------------------------------------------------------------------
// render -> parse roundtrip
// ---------------------------------------------------------------------------

describe('render -> parse roundtrip', () => {
  test('rendered output parses back to matching template', () => {
    const html = `
      <nav aria-label="Main">
        <ul>
          <li><a href="/home">Home</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </nav>
    `
    const tree = capture(html)
    const rendered = renderAriaTree(tree)
    const template = parseAriaTemplate(rendered)
    expect(matchAriaTree(tree, template)).toMatchInlineSnapshot(`
      {
        "actual": "- navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /home
          - listitem:
            - link:
              - text: About
              - /url: /about",
        "expected": "- navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /home
          - listitem:
            - link:
              - text: About
              - /url: /about",
        "mergedExpected": "- navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /home
          - listitem:
            - link:
              - text: About
              - /url: /about",
        "pass": true,
      }
    `)
  })

  test('roundtrip with all ARIA states', () => {
    const html = `
      <div role="checkbox" aria-checked="true" aria-label="A"></div>
      <button aria-disabled="true">B</button>
      <button aria-expanded="true">C</button>
      <button aria-expanded="false">D</button>
      <button aria-pressed="true">E</button>
      <button aria-pressed="mixed">F</button>
      <div role="option" aria-selected="true">G</div>
    `
    const tree = capture(html)
    const rendered = renderAriaTree(tree)
    const template = parseAriaTemplate(rendered)
    expect(matchAriaTree(tree, template)).toMatchInlineSnapshot(`
      {
        "actual": "- checkbox "A" [checked]
      - button [disabled]: B
      - button [expanded]: C
      - button [expanded=false]: D
      - button [pressed]: E
      - button [pressed=mixed]: F
      - option [selected]: G",
        "expected": "- checkbox "A" [checked]
      - button [disabled]: B
      - button [expanded]: C
      - button [expanded=false]: D
      - button [pressed]: E
      - button [pressed=mixed]: F
      - option [selected]: G",
        "mergedExpected": "- checkbox "A" [checked]
      - button [disabled]: B
      - button [expanded]: C
      - button [expanded=false]: D
      - button [pressed]: E
      - button [pressed=mixed]: F
      - option [selected]: G",
        "pass": true,
      }
    `)
  })
})

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

describe('matchAriaTree', () => {
  test('exact match', () => {
    expect(match('<h1>Hello</h1>', '- heading [level=1]')).toMatchInlineSnapshot(`
      {
        "actual": "
      - heading [level=1]: Hello
      ",
        "expected": "
      - heading [level=1]
      ",
        "mergedExpected": "
      - heading [level=1]
      ",
        "pass": true,
      }
    `)
  })

  test('name match', () => {
    expect(match(
      '<button aria-label="Submit">Go</button>',
      '- button "Submit"',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button "Submit": Go
      ",
        "expected": "
      - button "Submit"
      ",
        "mergedExpected": "
      - button "Submit"
      ",
        "pass": true,
      }
    `)
  })

  test('name mismatch', () => {
    expect(match(
      '<button aria-label="Submit">Go</button>',
      '- button "Cancel"',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button "Submit": Go
      ",
        "expected": "
      - button "Cancel"
      ",
        "mergedExpected": "
      - button "Submit": Go
      ",
        "pass": false,
      }
    `)
  })

  test('regex name match', () => {
    expect(match(
      '<button aria-label="User 42">Go</button>',
      '- button /User \\d+/',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button /User \\d+/: Go
      ",
        "expected": "
      - button /User \\d+/
      ",
        "mergedExpected": "
      - button /User \\d+/
      ",
        "pass": true,
      }
    `)
  })

  test('regex name mismatch', () => {
    expect(match(
      '<button aria-label="User 42">Go</button>',
      '- button /Goodbye/',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button "User 42": Go
      ",
        "expected": "
      - button /Goodbye/
      ",
        "mergedExpected": "
      - button "User 42": Go
      ",
        "pass": false,
      }
    `)
  })

  // Contain semantics: template is a subset of actual children.
  // The template doesn't need to list every child — only the ones you care about.

  test('contain semantics — skip unmentioned siblings by distinct role', () => {
    // Template mentions heading and button, skipping the paragraph in between.
    // Works because pairChildren matches by role, and these are distinct roles.
    expect(match(`
      <h1>Title</h1>
      <p>Body text</p>
      <button>Submit</button>
    `, `
      - heading [level=1]
      - button
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - heading [level=1]: Title
      - paragraph: Body text
      - button: Submit
      ",
        "expected": "
      - heading [level=1]
      - button
      ",
        "mergedExpected": "
      - heading [level=1]
      - button
      ",
        "pass": true,
      }
    `)
  })

  test('contain semantics — match first of repeated role', () => {
    // When template matches the first child of a repeated role, pairing works.
    expect(match(`
      <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
      </ul>
    `, `
      - list:
        - listitem: One
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - list:
        - listitem: One
        - listitem: Two
        - listitem: Three
      ",
        "expected": "
      - list:
        - listitem: One
      ",
        "mergedExpected": "
      - list:
        - listitem: One
      ",
        "pass": true,
      }
    `)
  })



  test('contain semantics — match non-first child of same role by text', () => {
    expect(match(`
      <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
      </ul>
    `, `
      - list:
        - listitem: Two
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - list:
        - listitem: One
        - listitem: Two
        - listitem: Three
      ",
        "expected": "
      - list:
        - listitem: Two
      ",
        "mergedExpected": "
      - list:
        - listitem: Two
      ",
        "pass": true,
      }
    `)
  })

  test('contain semantics — subsequence by text', () => {
    expect(match(`
      <ul>
        <li>A</li>
        <li>B</li>
        <li>C</li>
      </ul>
    `, `
      - list:
        - listitem: A
        - listitem: C
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - list:
        - listitem: A
        - listitem: B
        - listitem: C
      ",
        "expected": "
      - list:
        - listitem: A
        - listitem: C
      ",
        "mergedExpected": "
      - list:
        - listitem: A
        - listitem: C
      ",
        "pass": true,
      }
    `)
  })

  test('contain semantics — template with no children matches any node', () => {
    // Template says "there's a list" without specifying children.
    expect(match(`
      <ul>
        <li>One</li>
        <li>Two</li>
      </ul>
    `, '- list')).toMatchInlineSnapshot(`
      {
        "actual": "
      - list:
        - listitem: One
        - listitem: Two
      ",
        "expected": "
      - list
      ",
        "mergedExpected": "
      - list
      ",
        "pass": true,
      }
    `)
  })

  test('contain semantics — nested partial match', () => {
    // Match a deeply nested structure, only mentioning the first listitem.
    expect(match(`
      <nav aria-label="Main">
        <ul>
          <li><button>Home</button></li>
          <li><button>About</button></li>
          <li><button>Contact</button></li>
        </ul>
      </nav>
    `, `
      - navigation "Main":
        - list:
          - listitem:
            - button: Home
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - navigation "Main":
        - list:
          - listitem:
            - button: Home
          - listitem:
            - button: About
          - listitem:
            - button: Contact
      ",
        "expected": "
      - navigation "Main":
        - list:
          - listitem:
            - button: Home
      ",
        "mergedExpected": "
      - navigation "Main":
        - list:
          - listitem:
            - button: Home
      ",
        "pass": true,
      }
    `)
  })

  test('contain semantics — bail out to full re-render when sibling fails', () => {
    // Two lists: first partially matches (template asks for A only, B is unmentioned),
    // second fails (template says WRONG but actual is X).
    // Because list2 can't pair, bail-out renders ALL actuals at this level.
    // List1's partial form is lost (B included) — that's the Attempt 1 tradeoff.
    expect(match(`
      <ul><li>A</li><li>B</li></ul>
      <ul><li>X</li><li>Y</li></ul>
    `, `
      - list:
        - listitem: A
      - list:
        - listitem: WRONG
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - list:
        - listitem: A
        - listitem: B
      - list:
        - listitem: X
        - listitem: Y
      ",
        "expected": "
      - list:
        - listitem: A
      - list:
        - listitem: WRONG
      ",
        "mergedExpected": "
      - list:
        - listitem: A
      - list:
        - listitem: X
        - listitem: Y
      ",
        "pass": false,
      }
    `)
  })

  test('attribute match — checked', () => {
    expect(match(
      '<div role="checkbox" aria-checked="true" aria-label="A"></div>',
      '- checkbox "A" [checked]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - checkbox "A" [checked]
      ",
        "expected": "
      - checkbox "A" [checked]
      ",
        "mergedExpected": "
      - checkbox "A" [checked]
      ",
        "pass": true,
      }
    `)
  })

  test('attribute mismatch — wrong level', () => {
    expect(match('<h2>Title</h2>', '- heading [level=1]')).toMatchInlineSnapshot(`
      {
        "actual": "
      - heading [level=2]: Title
      ",
        "expected": "
      - heading [level=1]
      ",
        "mergedExpected": "
      - heading [level=2]: Title
      ",
        "pass": false,
      }
    `)
  })

  test('role mismatch', () => {
    expect(match('<button>Click</button>', '- link')).toMatchInlineSnapshot(`
      {
        "actual": "
      - button: Click
      ",
        "expected": "
      - link
      ",
        "mergedExpected": "
      - button: Click
      ",
        "pass": false,
      }
    `)
  })

  test('regex text child match', () => {
    expect(match(
      '<p>You have 7 notifications</p>',
      '- paragraph: /You have \\d+ notifications/',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - paragraph: /You have \\d+ notifications/
      ",
        "expected": "
      - paragraph: /You have \\d+ notifications/
      ",
        "mergedExpected": "
      - paragraph: /You have \\d+ notifications/
      ",
        "pass": true,
      }
    `)
  })

  test('regex text child mismatch', () => {
    expect(match(
      '<p>You have 7 notifications</p>',
      '- paragraph: /\\d+ errors/',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - paragraph: You have 7 notifications
      ",
        "expected": "
      - paragraph: /\\d+ errors/
      ",
        "mergedExpected": "
      - paragraph: You have 7 notifications
      ",
        "pass": false,
      }
    `)
  })

  test('merge preserves regex name, updates mismatched text', () => {
    expect(match(`
      <button aria-label="User 99">Profile</button>
      <p>You have 3 messages</p>
    `, `
      - button /User \\d+/: Profile
      - paragraph: You have 7 notifications
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - button /User \\d+/: Profile
      - paragraph: You have 3 messages
      ",
        "expected": "
      - button /User \\d+/: Profile
      - paragraph: You have 7 notifications
      ",
        "mergedExpected": "
      - button /User \\d+/: Profile
      - paragraph: You have 3 messages
      ",
        "pass": false,
      }
    `)
  })

  // TODO: this cause full update. how to preserve second regex?
  test('literal mismatch first and regex match second', () => {
    expect(match(`
      <p>You have 3 messages</p>
      <button aria-label="User 99">Profile</button>
    `, `
      - paragraph: You have 7 notifications
      - button /User \\d+/: Profile
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - paragraph: You have 3 messages
      - button "User 99": Profile
      ",
        "expected": "
      - paragraph: You have 7 notifications
      - button /User \\d+/: Profile
      ",
        "mergedExpected": "
      - paragraph: You have 3 messages
      - button "User 99": Profile
      ",
        "pass": false,
      }
    `)
  })

 test('flipped regex match', () => {
    expect(match(`
      <button>Submit</button>
      <button>Cancel</button>
    `, `
      - button: Cancel
      - paragraph: /\w+/
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - button: Submit
      - button: Cancel
      ",
        "expected": "
      - button: Cancel
      - paragraph: /w+/
      ",
        "mergedExpected": "
      - button: Submit
      - button: Cancel
      ",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "disabled attribute"
  test('attribute match — disabled', () => {
    expect(match(
      '<button aria-disabled="true">Click me</button>',
      '- button [disabled]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button [disabled]: Click me
      ",
        "expected": "
      - button [disabled]
      ",
        "mergedExpected": "
      - button [disabled]
      ",
        "pass": true,
      }
    `)
  })

  test('attribute mismatch — disabled expected but not present', () => {
    expect(match(
      '<button>Click me</button>',
      '- button [disabled]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button: Click me
      ",
        "expected": "
      - button [disabled]
      ",
        "mergedExpected": "
      - button: Click me
      ",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "expanded attribute"
  test('attribute match — expanded', () => {
    expect(match(
      '<button aria-expanded="true">Toggle</button>',
      '- button [expanded]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button [expanded]: Toggle
      ",
        "expected": "
      - button [expanded]
      ",
        "mergedExpected": "
      - button [expanded]
      ",
        "pass": true,
      }
    `)
  })

  test('attribute mismatch — expanded=false vs expanded=true', () => {
    expect(match(
      '<button aria-expanded="true">Toggle</button>',
      '- button [expanded=false]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button [expanded]: Toggle
      ",
        "expected": "
      - button [expanded=false]
      ",
        "mergedExpected": "
      - button [expanded]: Toggle
      ",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "pressed attribute"
  test('attribute match — pressed', () => {
    expect(match(
      '<button aria-pressed="true">Like</button>',
      '- button [pressed]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button [pressed]: Like
      ",
        "expected": "
      - button [pressed]
      ",
        "mergedExpected": "
      - button [pressed]
      ",
        "pass": true,
      }
    `)
  })

  test('attribute match — pressed=mixed', () => {
    expect(match(
      '<button aria-pressed="mixed">Like</button>',
      '- button [pressed=mixed]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button [pressed=mixed]: Like
      ",
        "expected": "
      - button [pressed=mixed]
      ",
        "mergedExpected": "
      - button [pressed=mixed]
      ",
        "pass": true,
      }
    `)
  })

  test('attribute mismatch — pressed=true vs pressed=mixed', () => {
    expect(match(
      '<button aria-pressed="mixed">Like</button>',
      '- button [pressed]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - button [pressed=mixed]: Like
      ",
        "expected": "
      - button [pressed]
      ",
        "mergedExpected": "
      - button [pressed=mixed]: Like
      ",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "selected attribute"
  test('attribute match — selected', () => {
    expect(match(
      '<div role="option" aria-selected="true">Row</div>',
      '- option [selected]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - option [selected]: Row
      ",
        "expected": "
      - option [selected]
      ",
        "mergedExpected": "
      - option [selected]
      ",
        "pass": true,
      }
    `)
  })

  test('attribute mismatch — selected expected but not present', () => {
    expect(match(
      '<div role="option">Row</div>',
      '- option [selected]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - option: Row
      ",
        "expected": "
      - option [selected]
      ",
        "mergedExpected": "
      - option: Row
      ",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "checked attribute"
  test('attribute match — checked=mixed', () => {
    expect(match(
      '<div role="checkbox" aria-checked="mixed" aria-label="A"></div>',
      '- checkbox "A" [checked=mixed]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - checkbox "A" [checked=mixed]
      ",
        "expected": "
      - checkbox "A" [checked=mixed]
      ",
        "mergedExpected": "
      - checkbox "A" [checked=mixed]
      ",
        "pass": true,
      }
    `)
  })

  test('attribute mismatch — checked vs checked=mixed', () => {
    expect(match(
      '<div role="checkbox" aria-checked="mixed" aria-label="A"></div>',
      '- checkbox "A" [checked]',
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - checkbox "A" [checked=mixed]
      ",
        "expected": "
      - checkbox "A" [checked]
      ",
        "mergedExpected": "
      - checkbox "A" [checked=mixed]
      ",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "should match in list"
  test('contain semantics — matches subset of siblings', () => {
    // Template asks for a heading with name "title" which is not set via aria-label,
    // so name is "" on both headings. Template name "title" won't match "" → fails.
    // This differs from Playwright which uses accessible name computation that
    // includes text content in the name.
    expect(match(`
      <h1>title</h1>
      <h1>title 2</h1>
    `, `
      - heading "title"
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - heading [level=1]: title
      - heading [level=1]: title 2
      ",
        "expected": "
      - heading "title"
      ",
        "mergedExpected": "
      - heading [level=1]: title
      - heading [level=1]: title 2
      ",
        "pass": false,
      }
    `)
  })

  // Behavioral test: empty template produces zero template children,
  // and containsList(anything, []) returns true (vacuous truth).
  // Same semantics as Playwright — "I don't care what's here."
  test('empty template matches anything', () => {
    expect(match('<p>anything</p>', '')).toMatchInlineSnapshot(`
      {
        "actual": "
      - paragraph: anything
      ",
        "expected": "

      ",
        "mergedExpected": "

      ",
        "pass": true,
      }
    `)
  })

  // -- Gap: deeply nested mismatch
  test('deeply nested text mismatch', () => {
    expect(match(`
      <nav aria-label="Main">
        <ul>
          <li><a href="/a">Home</a></li>
        </ul>
      </nav>
    `, `
      - navigation "Main":
        - list:
          - listitem:
            - link: Away
    `)).toMatchInlineSnapshot(`
      {
        "actual": "
      - navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /a
      ",
        "expected": "
      - navigation "Main":
        - list:
          - listitem:
            - link: Away
      ",
        "mergedExpected": "
      - navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /a
      ",
        "pass": false,
      }
    `)
  })

  // -- Gap: top-level text template node
  test('top-level text template node', () => {
    const tree = capture('<p>hello</p>')
    const textTemplate = { kind: 'text' as const, text: 'hello' }
    expect(matchAriaTree(tree, textTemplate)).toMatchInlineSnapshot(`
      {
        "actual": "- paragraph: hello",
        "expected": "hello",
        "mergedExpected": "- paragraph: hello",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: to-match-aria-snapshot.spec.ts "should match url"
  test('/url: pseudo-attribute matches', () => {
    // TODO: why mergedExpected got stricter if pass?
    expect(match(
      '<a href="https://example.com">Link</a>',
      `\
- link:
  - /url: /.*example.com/
`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Link
        - /url: https://example.com
      ",
        "expected": "
      - link:
        - /url: https://example.com
      ",
        "mergedExpected": "
      - link:
        - /url: https://example.com
      ",
        "pass": true,
      }
    `)
  })

  test('/url: pseudo-attribute mismatch', () => {
    expect(match(
      '<a href="https://example.com">Link</a>',
      `\
- link:
  - /url: /.*other.com/`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Link
        - /url: https://example.com
      ",
        "expected": "
      - link
      ",
        "mergedExpected": "
      - link:
        - text: Link
        - /url: https://example.com
      ",
        "pass": false,
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should snapshot placeholder"
  test('/placeholder: pseudo-attribute matches', () => {
    expect(match(
      '<input placeholder="Enter name">',
      `\
- textbox:
  - /placeholder: Enter name`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - textbox:
        - /placeholder: Enter name
      ",
        "expected": "
      - textbox:
        - /placeholder: Enter name
      ",
        "mergedExpected": "
      - textbox:
        - /placeholder: Enter name
      ",
        "pass": true,
      }
    `)
  })

  test('/placeholder: pseudo-attribute mismatch', () => {
    // TODO: why expected dropped /placeholder?
    expect(match(
      '<input placeholder="Enter name">',
      `
- textbox:
  - /placeholder: Wrong`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - textbox:
        - /placeholder: Enter name
      ",
        "expected": "
      - textbox
      ",
        "mergedExpected": "
      - textbox:
        - /placeholder: Enter name
      ",
        "pass": false,
      }
    `)
  })
})
