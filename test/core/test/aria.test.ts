// @vitest-environment happy-dom

import { captureAriaTree, matchAriaTree, parseAriaTemplate, renderAriaTree } from '@vitest/snapshot/aria'
import { describe, expect, test } from 'vitest'

function capture(html: string) {
  document.body.innerHTML = html
  return captureAriaTree(document.body)
}

function render(html: string) {
  return renderAriaTree(capture(html))
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
            - link: A
          - listitem:
            - link: B"
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
    expect(matchAriaTree(tree, template)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

describe('matchAriaTree', () => {
  test('exact match', () => {
    const tree = capture('<h1>Hello</h1>')
    const t = parseAriaTemplate('- heading [level=1]')
    expect(matchAriaTree(tree, t)).toBe(true)
  })

  test('name match', () => {
    const tree = capture('<button aria-label="Submit">Go</button>')
    expect(matchAriaTree(tree, parseAriaTemplate('- button "Submit"'))).toBe(true)
    expect(matchAriaTree(tree, parseAriaTemplate('- button "Cancel"'))).toBe(false)
  })

  test('regex name match', () => {
    const tree = capture('<button aria-label="User 42">Go</button>')
    expect(matchAriaTree(tree, parseAriaTemplate('- button /User \\d+/'))).toBe(true)
    expect(matchAriaTree(tree, parseAriaTemplate('- button /Goodbye/'))).toBe(false)
  })

  test('contain semantics — partial children match', () => {
    const tree = capture(`
      <ul>
        <li>One</li>
        <li>Two</li>
        <li>Three</li>
      </ul>
    `)
    // Template only mentions Two — contain mode should find it
    const t = parseAriaTemplate(`
      - list:
        - listitem: Two
    `)
    expect(matchAriaTree(tree, t)).toBe(true)
  })

  test('contain semantics — order matters', () => {
    const tree = capture(`
      <ul>
        <li>A</li>
        <li>B</li>
        <li>C</li>
      </ul>
    `)
    // A before C — passes
    expect(matchAriaTree(tree, parseAriaTemplate(`
      - list:
        - listitem: A
        - listitem: C
    `))).toBe(true)

    // C before A — fails (order-preserving)
    expect(matchAriaTree(tree, parseAriaTemplate(`
      - list:
        - listitem: C
        - listitem: A
    `))).toBe(false)
  })

  test('deep match — finds node in subtree', () => {
    const tree = capture(`
      <nav aria-label="Main">
        <ul>
          <li><a href="/x">Deep Link</a></li>
        </ul>
      </nav>
    `)
    // Match the link directly even though it's deeply nested
    const t = parseAriaTemplate('- link: Deep Link')
    expect(matchAriaTree(tree, t)).toBe(true)
  })

  test('attribute match — checked', () => {
    const tree = capture('<div role="checkbox" aria-checked="true" aria-label="A"></div>')
    expect(matchAriaTree(tree, parseAriaTemplate('- checkbox "A" [checked]'))).toBe(true)
    expect(matchAriaTree(tree, parseAriaTemplate('- checkbox "A"'))).toBe(true) // no constraint = ok
  })

  test('attribute mismatch — wrong level', () => {
    const tree = capture('<h2>Title</h2>')
    expect(matchAriaTree(tree, parseAriaTemplate('- heading [level=2]'))).toBe(true)
    expect(matchAriaTree(tree, parseAriaTemplate('- heading [level=1]'))).toBe(false)
  })

  test('role mismatch', () => {
    const tree = capture('<button>Click</button>')
    expect(matchAriaTree(tree, parseAriaTemplate('- link'))).toBe(false)
  })

  test('regex text child', () => {
    const tree = capture('<p>You have 7 notifications</p>')
    expect(matchAriaTree(tree, parseAriaTemplate('- paragraph: /You have \\d+ notifications/'))).toBe(true)
    expect(matchAriaTree(tree, parseAriaTemplate('- paragraph: /\\d+ errors/'))).toBe(false)
  })
})
