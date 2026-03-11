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
    expect(matchAriaTree(tree, template).pass).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

function match(html: string, template: string) {
  const r = matchAriaTree(capture(html), parseAriaTemplate(template))
  return {
    pass: r.pass,
    actual: `\n${r.actual}\n`,
    expected: `\n${r.expected}\n`,
    mergedExpected: `\n${r.mergedExpected}\n`,
  }
}

describe('matchAriaTree', () => {
  test('exact match', () => {
    expect(match('<h1>Hello</h1>', '- heading [level=1]')).toMatchInlineSnapshot(`
      {
        "actual": "
      - heading [level=1]: Hello
      ",
        "expected": "
      - heading [level=1]: Hello
      ",
        "mergedExpected": "
      - heading [level=1]: Hello
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
      - button "Submit": Go
      ",
        "mergedExpected": "
      - button "Submit": Go
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
      - button "Cancel": Go
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
      - button /User \\d+/: Go
      ",
        "mergedExpected": "
      - button /User \\d+/: Go
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
      - button /Goodbye/: Go
      ",
        "mergedExpected": "
      - button "User 42": Go
      ",
        "pass": false,
      }
    `)
  })

  test('contain semantics — partial children match', () => {
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
        - listitem: Two
        - listitem: Three
      ",
        "mergedExpected": "
      - list:
        - listitem: One
        - listitem: Two
        - listitem: Three
      ",
        "pass": false,
      }
    `)
  })

  test('contain semantics — order matters (A before C passes)', () => {
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
        - listitem: C
      ",
        "mergedExpected": "
      - list:
        - listitem: A
        - listitem: B
        - listitem: C
      ",
        "pass": false,
      }
    `)
  })

  test('contain semantics — order matters (C before A fails)', () => {
    expect(match(`
      <ul>
        <li>A</li>
        <li>B</li>
        <li>C</li>
      </ul>
    `, `
      - list:
        - listitem: C
        - listitem: A
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
        - listitem: C
        - listitem: A
        - listitem: C
      ",
        "mergedExpected": "
      - list:
        - listitem: A
        - listitem: B
        - listitem: C
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
      - heading [level=1]: Title
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
      - button: Click
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
})
