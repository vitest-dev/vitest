// @vitest-environment happy-dom

/**
 * Tests for the ARIA snapshot pipeline.
 *
 * Based on Playwright v1.58.2 tests:
 *   https://github.com/microsoft/playwright/blob/v1.58.2/tests/page/to-match-aria-snapshot.spec.ts
 *   https://github.com/microsoft/playwright/blob/v1.58.2/tests/page/page-aria-snapshot.spec.ts
 */

import type { AriaTemplateRoleNode } from '@vitest/snapshot/aria'
import { captureAriaTree, matchAriaTree, parseAriaTemplate, renderAriaTree } from '@vitest/snapshot/aria'
import { describe, expect, test } from 'vitest'

function capture(html: string) {
  document.body.innerHTML = html
  return captureAriaTree(document.body)
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

function runPipeline(html: string) {
  const captured = capture(html)
  const rendered = renderAriaTree(captured)
  const parsed = parseAriaTemplate(rendered)
  const matched = matchAriaTree(captured, parsed)
  return {
    captured,
    rendered,
    parsed,
    matched,
    snapshot: {
      captured: captured.children,
      rendered: `\n${rendered}\n`,
      pass: matched.pass,
    },
  }
}

describe('basic', () => {
  test('heading', () => {
    const result = runPipeline('<h1>Hello</h1>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Hello",
            ],
            "level": 1,
            "name": "",
            "role": "heading",
          },
        ],
        "pass": true,
        "rendered": "
      - heading [level=1]: Hello
      ",
      }
    `)
  })

  test('link with href', () => {
    const result = runPipeline('<a href="/foo">Click</a>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Click",
            ],
            "name": "",
            "role": "link",
            "url": "/foo",
          },
        ],
        "pass": true,
        "rendered": "
      - link:
        - text: Click
        - /url: /foo
      ",
      }
    `)
  })

  test('anchor without href has no role', () => {
    const result = runPipeline('<a>Not a link</a>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "Not a link",
        ],
        "pass": true,
        "rendered": "
      - text: Not a link
      ",
      }
    `)
  })

  test('aria-label sets name', () => {
    const result = runPipeline('<button aria-label="Close">X</button>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "X",
            ],
            "name": "Close",
            "role": "button",
          },
        ],
        "pass": true,
        "rendered": "
      - button "Close": X
      ",
      }
    `)
  })

  test('explicit role overrides implicit', () => {
    const result = runPipeline('<div role="alert">Warning!</div>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Warning!",
            ],
            "name": "",
            "role": "alert",
          },
        ],
        "pass": true,
        "rendered": "
      - alert: Warning!
      ",
      }
    `)
  })

  test('aria-hidden elements are excluded', () => {
    const result = runPipeline('<div aria-hidden="true">Hidden</div><p>Visible</p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Visible",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - paragraph: Visible
      ",
      }
    `)
  })

  test('checkbox states', () => {
    const result = runPipeline(`
      <div role="checkbox" aria-checked="true" aria-label="A"></div>
      <div role="checkbox" aria-checked="false" aria-label="B"></div>
      <div role="checkbox" aria-checked="mixed" aria-label="C"></div>
    `)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "checked": true,
            "children": [],
            "name": "A",
            "role": "checkbox",
          },
          {
            "checked": false,
            "children": [],
            "name": "B",
            "role": "checkbox",
          },
          {
            "checked": "mixed",
            "children": [],
            "name": "C",
            "role": "checkbox",
          },
        ],
        "pass": true,
        "rendered": "
      - checkbox "A" [checked]
      - checkbox "B"
      - checkbox "C" [checked=mixed]
      ",
      }
    `)
  })

  test('nested list structure', () => {
    const result = runPipeline('<ul><li>One</li><li>Two</li></ul>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              {
                "children": [
                  "One",
                ],
                "name": "",
                "role": "listitem",
              },
              {
                "children": [
                  "Two",
                ],
                "name": "",
                "role": "listitem",
              },
            ],
            "name": "",
            "role": "list",
          },
        ],
        "pass": true,
        "rendered": "
      - list:
        - listitem: One
        - listitem: Two
      ",
      }
    `)
  })

  test('label for input', () => {
    const result = runPipeline('<label for="x">Name</label><input id="x" type="text" />')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "Name",
          {
            "children": [],
            "name": "Name",
            "role": "textbox",
          },
        ],
        "pass": true,
        "rendered": "
      - text: Name
      - textbox "Name"
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "check aria-hidden text"
  test('aria-hidden nested children excluded', () => {
    const result = runPipeline('<p><span>hello</span><span aria-hidden="true">world</span></p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "hello",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - paragraph: hello
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should ignore presentation and none roles"
  // happy-dom strips trailing whitespace from text nodes during innerHTML parsing,
  // so inter-element spacing is lost. Verified logic works: presentation/none roles
  // are correctly skipped in getRole() and children are promoted.
  test('role="presentation" and role="none" promote children', () => {
    const result = runPipeline('<ul><li role="presentation">hello</li><li role="none">world</li></ul>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "helloworld",
            ],
            "name": "",
            "role": "list",
          },
        ],
        "pass": true,
        "rendered": "
      - list: helloworld
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should concatenate span text"
  // happy-dom strips trailing whitespace from text nodes during innerHTML parsing
  test('concatenates inline text across spans', () => {
    const result = runPipeline('<span>One</span> <span>Two</span> <span>Three</span>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "OneTwoThree",
        ],
        "pass": true,
        "rendered": "
      - text: OneTwoThree
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should concatenate div text with spaces"
  // happy-dom strips trailing whitespace from text nodes during innerHTML parsing
  test('concatenates div text', () => {
    const result = runPipeline('<div>One</div><div>Two</div><div>Three</div>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "OneTwoThree",
        ],
        "pass": true,
        "rendered": "
      - text: OneTwoThree
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should support multiline text"
  test('multiline text collapses whitespace', () => {
    const result = runPipeline('<p>Line 1\n      Line 2\n      Line 3</p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Line 1 Line 2 Line 3",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - paragraph: Line 1 Line 2 Line 3
      ",
      }
    `)
  })

  // -- Gap: hidden HTML attribute
  test('hidden attribute excludes element', () => {
    const result = runPipeline('<div hidden>Hidden</div><p>Visible</p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Visible",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - paragraph: Visible
      ",
      }
    `)
  })

  // -- Gap: style/script/noscript/template tags
  test('style, script, noscript, template tags are excluded', () => {
    const result = runPipeline('<style>.x{}</style><script>var x</script><noscript>No JS</noscript><template><p>T</p></template><p>Visible</p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Visible",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - paragraph: Visible
      ",
      }
    `)
  })

  // -- Gap: aria-labelledby
  test('aria-labelledby resolves name from referenced elements', () => {
    const result = runPipeline('<span id="a">Hello</span><span id="b">World</span><button aria-labelledby="a b">X</button>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "HelloWorld",
          {
            "children": [
              "X",
            ],
            "name": "Hello World",
            "role": "button",
          },
        ],
        "pass": true,
        "rendered": "
      - text: HelloWorld
      - button "Hello World": X
      ",
      }
    `)
  })

  // -- Gap: IMG alt text
  test('img alt text as accessible name', () => {
    const result = runPipeline('<img alt="Logo">')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "Logo",
            "role": "img",
          },
        ],
        "pass": true,
        "rendered": "
      - img "Logo"
      ",
      }
    `)
  })

  // -- Gap: IMG empty alt -> presentation (skipped)
  test('img with empty alt has presentation role (children promoted)', () => {
    const result = runPipeline('<img alt="">')
    // Empty alt = presentation role, which is skipped (no node emitted)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [],
        "pass": true,
        "rendered": "

      ",
      }
    `)
  })

  // -- Gap: INPUT type variants
  test('input type variants', () => {
    const result = runPipeline(`
      <input type="radio">
      <input type="submit">
      <input type="reset">
      <input type="image">
      <input type="range">
      <input type="search">
      <input type="checkbox">
      <input>
    `)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "",
            "role": "radio",
          },
          {
            "children": [],
            "name": "",
            "role": "button",
          },
          {
            "children": [],
            "name": "",
            "role": "button",
          },
          {
            "children": [],
            "name": "",
            "role": "button",
          },
          {
            "children": [],
            "name": "",
            "role": "slider",
          },
          {
            "children": [],
            "name": "",
            "role": "searchbox",
          },
          {
            "children": [],
            "name": "",
            "role": "checkbox",
          },
          {
            "children": [],
            "name": "",
            "role": "textbox",
          },
        ],
        "pass": true,
        "rendered": "
      - radio
      - button
      - button
      - button
      - slider
      - searchbox
      - checkbox
      - textbox
      ",
      }
    `)
  })

  // -- Gap: SELECT -> combobox
  test('select has combobox role', () => {
    const result = runPipeline('<select><option>A</option></select>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              {
                "children": [
                  "A",
                ],
                "name": "",
                "role": "option",
              },
            ],
            "name": "",
            "role": "combobox",
          },
        ],
        "pass": true,
        "rendered": "
      - combobox:
        - option: A
      ",
      }
    `)
  })

  // -- Gap: TEXTAREA -> textbox
  test('textarea has textbox role', () => {
    const result = runPipeline('<textarea></textarea>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "",
            "role": "textbox",
          },
        ],
        "pass": true,
        "rendered": "
      - textbox
      ",
      }
    `)
  })

  // -- Gap: SECTION with/without aria-label
  test('section with aria-label has region role', () => {
    const result = runPipeline('<section aria-label="S">content</section>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "content",
            ],
            "name": "S",
            "role": "region",
          },
        ],
        "pass": true,
        "rendered": "
      - region "S": content
      ",
      }
    `)
  })

  test('section without aria-label has no role', () => {
    const result = runPipeline('<section>content</section>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "content",
        ],
        "pass": true,
        "rendered": "
      - text: content
      ",
      }
    `)
  })

  // -- Gap: table elements
  test('table structure roles', () => {
    const result = runPipeline(`
      <table>
        <thead><tr><th>H</th></tr></thead>
        <tbody><tr><td>D</td></tr></tbody>
        <tfoot><tr><td>F</td></tr></tfoot>
      </table>
    `)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "children": [
                          "H",
                        ],
                        "name": "",
                        "role": "columnheader",
                      },
                    ],
                    "name": "",
                    "role": "row",
                  },
                ],
                "name": "",
                "role": "rowgroup",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "children": [
                          "D",
                        ],
                        "name": "",
                        "role": "cell",
                      },
                    ],
                    "name": "",
                    "role": "row",
                  },
                ],
                "name": "",
                "role": "rowgroup",
              },
              {
                "children": [
                  {
                    "children": [
                      {
                        "children": [
                          "F",
                        ],
                        "name": "",
                        "role": "cell",
                      },
                    ],
                    "name": "",
                    "role": "row",
                  },
                ],
                "name": "",
                "role": "rowgroup",
              },
            ],
            "name": "",
            "role": "table",
          },
        ],
        "pass": true,
        "rendered": "
      - table:
        - rowgroup:
          - row:
            - columnheader: H
        - rowgroup:
          - row:
            - cell: D
        - rowgroup:
          - row:
            - cell: F
      ",
      }
    `)
  })

  // -- Gap: other implicit roles
  test('other implicit roles', () => {
    const result = runPipeline(`
      <article>x</article>
      <aside>x</aside>
      <dialog open>x</dialog>
      <fieldset><legend>L</legend></fieldset>
      <footer>x</footer>
      <form>x</form>
      <header>x</header>
      <hr>
      <main>x</main>
      <nav>x</nav>
      <ol><li>x</li></ol>
      <progress></progress>
    `)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "article",
          },
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "complementary",
          },
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "dialog",
          },
          {
            "children": [
              "L",
            ],
            "name": "",
            "role": "group",
          },
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "contentinfo",
          },
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "form",
          },
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "banner",
          },
          {
            "children": [],
            "name": "",
            "role": "separator",
          },
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "main",
          },
          {
            "children": [
              "x",
            ],
            "name": "",
            "role": "navigation",
          },
          {
            "children": [
              {
                "children": [
                  "x",
                ],
                "name": "",
                "role": "listitem",
              },
            ],
            "name": "",
            "role": "list",
          },
          {
            "children": [],
            "name": "",
            "role": "progressbar",
          },
        ],
        "pass": true,
        "rendered": "
      - article: x
      - complementary: x
      - dialog: x
      - group: L
      - contentinfo: x
      - form: x
      - banner: x
      - separator
      - main: x
      - navigation: x
      - list:
        - listitem: x
      - progressbar
      ",
      }
    `)
  })

  // -- Gap: explicit role with spaces (first token)
  test('explicit role with spaces takes first token', () => {
    const result = runPipeline('<div role="alert dialog">content</div>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "content",
            ],
            "name": "",
            "role": "alert",
          },
        ],
        "pass": true,
        "rendered": "
      - alert: content
      ",
      }
    `)
  })

  // -- Gap: name dedup
  test('sole child text matching name is deduplicated', () => {
    const result = runPipeline('<button aria-label="Click">Click</button>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "Click",
            "role": "button",
          },
        ],
        "pass": true,
        "rendered": "
      - button "Click"
      ",
      }
    `)
  })

  // -- Gap: aria-disabled, aria-expanded, aria-pressed, aria-selected capture
  test('aria-*', () => {
    const result = runPipeline(`
<button aria-disabled="true">X</button>
<button aria-expanded="true">X</button>
<button aria-expanded="false">X</button>
<button aria-pressed="true">X</button>
<button aria-pressed="mixed">X</button>
`)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "X",
            ],
            "disabled": true,
            "name": "",
            "role": "button",
          },
          {
            "children": [
              "X",
            ],
            "expanded": true,
            "name": "",
            "role": "button",
          },
          {
            "children": [
              "X",
            ],
            "expanded": false,
            "name": "",
            "role": "button",
          },
          {
            "children": [
              "X",
            ],
            "name": "",
            "pressed": true,
            "role": "button",
          },
          {
            "children": [
              "X",
            ],
            "name": "",
            "pressed": "mixed",
            "role": "button",
          },
        ],
        "pass": true,
        "rendered": "
      - button [disabled]: X
      - button [expanded]: X
      - button [expanded=false]: X
      - button [pressed]: X
      - button [pressed=mixed]: X
      ",
      }
    `)
  })

  test('aria-selected captured', () => {
    const result = runPipeline('<table><tr aria-selected="true"><td>X</td></tr></table>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "children": [
                          "X",
                        ],
                        "name": "",
                        "role": "cell",
                      },
                    ],
                    "name": "",
                    "role": "row",
                    "selected": true,
                  },
                ],
                "name": "",
                "role": "rowgroup",
              },
            ],
            "name": "",
            "role": "table",
          },
        ],
        "pass": true,
        "rendered": "
      - table:
        - rowgroup:
          - row [selected]:
            - cell: X
      ",
      }
    `)
  })

  // -- Gap: heading levels h2-h6
  test('heading levels h2 through h6', () => {
    const result = runPipeline(`
<h1>x</h1>
<h2>x</h2>
<h3>x</h3>
<h4>x</h4>
<h5>x</h5>
<h6>x</h6>
`)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "x",
            ],
            "level": 1,
            "name": "",
            "role": "heading",
          },
          {
            "children": [
              "x",
            ],
            "level": 2,
            "name": "",
            "role": "heading",
          },
          {
            "children": [
              "x",
            ],
            "level": 3,
            "name": "",
            "role": "heading",
          },
          {
            "children": [
              "x",
            ],
            "level": 4,
            "name": "",
            "role": "heading",
          },
          {
            "children": [
              "x",
            ],
            "level": 5,
            "name": "",
            "role": "heading",
          },
          {
            "children": [
              "x",
            ],
            "level": 6,
            "name": "",
            "role": "heading",
          },
        ],
        "pass": true,
        "rendered": "
      - heading [level=1]: x
      - heading [level=2]: x
      - heading [level=3]: x
      - heading [level=4]: x
      - heading [level=5]: x
      - heading [level=6]: x
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should treat input value as text in templates"
  test('input value as text content', () => {
    const result = runPipeline('<input value="hello world">')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "hello world",
            ],
            "name": "",
            "role": "textbox",
          },
        ],
        "pass": true,
        "rendered": "
      - textbox: hello world
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should treat input value as text in templates"
  test('checkbox and radio do not capture value as text', () => {
    const result = runPipeline('<input type="checkbox" checked><input type="radio" checked>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "",
            "role": "checkbox",
          },
          {
            "children": [],
            "name": "",
            "role": "radio",
          },
        ],
        "pass": true,
        "rendered": "
      - checkbox
      - radio
      ",
      }
    `)
  })

  // -- Ported from Playwright: page-aria-snapshot.spec.ts "should not report textarea textContent"
  test('textarea value tracking', () => {
    const result = runPipeline('<textarea>Before</textarea>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Before",
            ],
            "name": "",
            "role": "textbox",
          },
        ],
        "pass": true,
        "rendered": "
      - textbox: Before
      ",
      }
    `)
  })

  // -- /placeholder: pseudo-attribute for inputs
  // Ported from Playwright: page-aria-snapshot.spec.ts "should snapshot placeholder"
  test('input captures placeholder', () => {
    const result = runPipeline('<input placeholder="Enter name">')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "",
            "placeholder": "Enter name",
            "role": "textbox",
          },
        ],
        "pass": true,
        "rendered": "
      - textbox:
        - /placeholder: Enter name
      ",
      }
    `)
  })

  test('placeholder not captured when same as name', () => {
    // When placeholder is used as the accessible name (via happy-dom/browser),
    // we don't duplicate it. Our code checks placeholder !== name.
    const result = runPipeline('<input placeholder="Name" aria-label="Name">')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "Name",
            "role": "textbox",
          },
        ],
        "pass": true,
        "rendered": "
      - textbox "Name"
      ",
      }
    `)
  })

  // TODO
  // Playwright: page-aria-snapshot.spec.ts "should not show visible children of hidden elements"
  test('CSS visibility:hidden', () => {
    const result = runPipeline('<div style="visibility:hidden">Hidden</div><p>Visible</p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "Hidden",
          {
            "children": [
              "Visible",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - text: Hidden
      - paragraph: Visible
      ",
      }
    `)
  })

  // TODO
  // Playwright: page-aria-snapshot.spec.ts "should work with slots"
  test('shadow DOM slots', () => {
    const result = runPipeline('<div id="host"></div>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [],
        "pass": true,
        "rendered": "

      ",
      }
    `)
  })

  // TODO
  // Playwright: page-aria-snapshot.spec.ts "should include pseudo in text"
  test('CSS pseudo-elements', () => {
    const result = runPipeline('<p>Hello</p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "Hello",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - paragraph: Hello
      ",
      }
    `)
  })

  // TODO
  // Playwright: page-aria-snapshot.spec.ts "should respect aria-owns"
  test('aria-owns', () => {
    const result = runPipeline('<div role="list" aria-owns="item1"></div><div id="item1" role="listitem">Owned</div>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "",
            "role": "list",
          },
          {
            "children": [
              "Owned",
            ],
            "name": "",
            "role": "listitem",
          },
        ],
        "pass": true,
        "rendered": "
      - list
      - listitem: Owned
      ",
      }
    `)
  })

  test('nav with nested list', () => {
    const result = runPipeline(`
      <nav aria-label="Main">
        <ul>
          <li><a href="/a">A</a></li>
          <li><a href="/b">B</a></li>
        </ul>
      </nav>
    `)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              {
                "children": [
                  {
                    "children": [
                      {
                        "children": [
                          "A",
                        ],
                        "name": "",
                        "role": "link",
                        "url": "/a",
                      },
                    ],
                    "name": "",
                    "role": "listitem",
                  },
                  {
                    "children": [
                      {
                        "children": [
                          "B",
                        ],
                        "name": "",
                        "role": "link",
                        "url": "/b",
                      },
                    ],
                    "name": "",
                    "role": "listitem",
                  },
                ],
                "name": "",
                "role": "list",
              },
            ],
            "name": "Main",
            "role": "navigation",
          },
        ],
        "pass": true,
        "rendered": "
      - navigation "Main":
        - list:
          - listitem:
            - link:
              - text: A
              - /url: /a
          - listitem:
            - link:
              - text: B
              - /url: /b
      ",
      }
    `)
  })

  test('form with inputs', () => {
    const result = runPipeline(`
      <form>
        <label for="u">User</label>
        <input id="u" type="text" />
        <button type="submit">Go</button>
      </form>
    `)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "User",
              {
                "children": [],
                "name": "User",
                "role": "textbox",
              },
              {
                "children": [
                  "Go",
                ],
                "name": "",
                "role": "button",
              },
            ],
            "name": "",
            "role": "form",
          },
        ],
        "pass": true,
        "rendered": "
      - form:
        - text: User
        - textbox "User"
        - button: Go
      ",
      }
    `)
  })

  test('leaf node with no children', () => {
    const result = runPipeline('<button aria-label="X"></button>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "X",
            "role": "button",
          },
        ],
        "pass": true,
        "rendered": "
      - button "X"
      ",
      }
    `)
  })

  test('fragment with text and element children', () => {
    const result = runPipeline('Hello <p>World</p>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          "Hello",
          {
            "children": [
              "World",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - text: Hello
      - paragraph: World
      ",
      }
    `)
  })

  test('link url with no text children', () => {
    const result = runPipeline('<a href="/foo" aria-label="Go"></a>')
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [],
            "name": "Go",
            "role": "link",
            "url": "/foo",
          },
        ],
        "pass": true,
        "rendered": "
      - link "Go":
        - /url: /foo
      ",
      }
    `)
  })

  // TODO: YAML quoting/escaping not yet implemented (see aria.ts)
  // Playwright: page-aria-snapshot.spec.ts "should escape yaml text in text nodes",
  //   "should escape special yaml characters", "should escape special yaml values"
  // Current render does NOT quote/escape — these snapshots document the unescaped output.
  test('YAML escaping of special characters', () => {
    const result = runPipeline(`
<p>one: two</p>
<p>"quoted"</p>
<p>#comment</p>
<p>@at</p>
<p>[bracket]</p>
<p>true</p>
<p>123</p>
`)
    expect(result.snapshot).toMatchInlineSnapshot(`
      {
        "captured": [
          {
            "children": [
              "one: two",
            ],
            "name": "",
            "role": "paragraph",
          },
          {
            "children": [
              ""quoted"",
            ],
            "name": "",
            "role": "paragraph",
          },
          {
            "children": [
              "#comment",
            ],
            "name": "",
            "role": "paragraph",
          },
          {
            "children": [
              "@at",
            ],
            "name": "",
            "role": "paragraph",
          },
          {
            "children": [
              "[bracket]",
            ],
            "name": "",
            "role": "paragraph",
          },
          {
            "children": [
              "true",
            ],
            "name": "",
            "role": "paragraph",
          },
          {
            "children": [
              "123",
            ],
            "name": "",
            "role": "paragraph",
          },
        ],
        "pass": true,
        "rendered": "
      - paragraph: one: two
      - paragraph: "quoted"
      - paragraph: #comment
      - paragraph: @at
      - paragraph: [bracket]
      - paragraph: true
      - paragraph: 123
      ",
      }
    `)
  })
})

// Edge cases not covered by runPipeline (which tests render→parse→match roundtrip)
describe('parseAriaTemplate', () => {
  test('regex name', () => {
    const t = parseAriaTemplate('- heading /Welcome \\d+/')
    expect(t).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [],
            "kind": "role",
            "name": /Welcome \\\\d\\+/,
            "role": "heading",
          },
        ],
        "kind": "role",
        "role": "fragment",
      }
    `)
  })

  test('inline regex text child', () => {
    const t = parseAriaTemplate('- paragraph: /item \\d+/')
    expect(t).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "kind": "text",
                "text": /item \\\\d\\+/,
              },
            ],
            "kind": "role",
            "role": "paragraph",
          },
        ],
        "kind": "role",
        "role": "fragment",
      }
    `)
  })

  test('regex text node', () => {
    const t = parseAriaTemplate('- text: /hello \\d+/')
    expect(t).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "kind": "text",
            "text": /hello \\\\d\\+/,
          },
        ],
        "kind": "role",
        "role": "fragment",
      }
    `)
  })

  test('/url: pseudo-child parses as regex', () => {
    const t = parseAriaTemplate(`
      - link:
        - /url: /.*example.com/
    `)
    expect(t).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [],
            "kind": "role",
            "role": "link",
            "url": /\\.\\*example\\.com/,
          },
        ],
        "kind": "role",
        "role": "fragment",
      }
    `)
    expect((t.children![0] as AriaTemplateRoleNode).url).toBeInstanceOf(RegExp)
  })

  test('empty lines and non-list lines are skipped', () => {
    const t = parseAriaTemplate(`

      - button

      not a list item
      - link
    `)
    expect(t).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [],
            "kind": "role",
            "role": "button",
          },
          {
            "children": [],
            "kind": "role",
            "role": "link",
          },
        ],
        "kind": "role",
        "role": "fragment",
      }
    `)
  })

  test('throws on invalid role entry', () => {
    expect(() => parseAriaTemplate('- !@#'))
      .toThrowErrorMatchingInlineSnapshot(`[Error: Cannot parse aria template entry: !@#]`)
  })

  // TODO
  // Playwright: page-aria-snapshot.spec.ts "should support multiline text" (| syntax)
  test('YAML block scalar (| multiline)', () => {
    // Parser should support YAML block scalar syntax for multiline text.
    // Currently the | line and continuation lines are silently skipped.
    const t = parseAriaTemplate(`
      - paragraph: |
          Line one
          Line two
    `)
    expect(t).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [
              {
                "kind": "text",
                "text": "|",
              },
            ],
            "kind": "role",
            "role": "paragraph",
          },
        ],
        "kind": "role",
        "role": "fragment",
      }
    `)
  })

  // TODO
  // Playwright: to-match-aria-snapshot.spec.ts "should report error in YAML keys"
  test('parse error with source location', () => {
    // Parser should report the position of the error in the template string.
    // Currently throws a generic message without source location.
    expect(parseAriaTemplate('- button [invalid_attr]')).toMatchInlineSnapshot(`
      {
        "children": [
          {
            "children": [],
            "kind": "role",
            "role": "button",
          },
        ],
        "kind": "role",
        "role": "fragment",
      }
    `)
  })

  // TODO
  // Playwright: to-match-aria-snapshot.spec.ts "should detect unexpected children: equal"
  test('/children: equal|deep-equal|contain directives', () => {
    // /children: is a pseudo-child directive (like /url:, /placeholder:).
    // Currently the parser doesn't recognize it — the line is silently skipped.
    expect(() => {
      const t = parseAriaTemplate(`
        - list:
          - /children: equal
          - listitem: A
      `)
      expect(t).toMatchInlineSnapshot()
    }).toThrowErrorMatchingInlineSnapshot(`[Error: Cannot parse aria template entry: /children: equal]`)
  })
})

// ---------------------------------------------------------------------------
// match
// ---------------------------------------------------------------------------

describe('matchAriaTree', () => {
  test('roundtrip 1', () => {
    const html = `
      <nav aria-label="Main">
        <ul>
          <li><a href="/home">Home</a></li>
          <li><a href="/about">About</a></li>
        </ul>
      </nav>
    `
    expect(match(html, renderAriaTree(capture(html)))).toMatchInlineSnapshot(`
      {
        "actual": "
      - navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /home
          - listitem:
            - link:
              - text: About
              - /url: /about
      ",
        "expected": "
      - navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /home
          - listitem:
            - link:
              - text: About
              - /url: /about
      ",
        "mergedExpected": "
      - navigation "Main":
        - list:
          - listitem:
            - link:
              - text: Home
              - /url: /home
          - listitem:
            - link:
              - text: About
              - /url: /about
      ",
        "pass": true,
      }
    `)
  })

  test('roundtrip 2', () => {
    const html = `
      <div role="checkbox" aria-checked="true" aria-label="A"></div>
      <button aria-disabled="true">B</button>
      <button aria-expanded="true">C</button>
      <button aria-expanded="false">D</button>
      <button aria-pressed="true">E</button>
      <button aria-pressed="mixed">F</button>
      <div role="option" aria-selected="true">G</div>
    `
    expect(match(html, renderAriaTree(capture(html)))).toMatchInlineSnapshot(`
      {
        "actual": "
      - checkbox "A" [checked]
      - button [disabled]: B
      - button [expanded]: C
      - button [expanded=false]: D
      - button [pressed]: E
      - button [pressed=mixed]: F
      - option [selected]: G
      ",
        "expected": "
      - checkbox "A" [checked]
      - button [disabled]: B
      - button [expanded]: C
      - button [expanded=false]: D
      - button [pressed]: E
      - button [pressed=mixed]: F
      - option [selected]: G
      ",
        "mergedExpected": "
      - checkbox "A" [checked]
      - button [disabled]: B
      - button [expanded]: C
      - button [expanded=false]: D
      - button [pressed]: E
      - button [pressed=mixed]: F
      - option [selected]: G
      ",
        "pass": true,
      }
    `)
  })

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
        - /url: /.*example.com/
      ",
        "expected": "
      - link:
        - /url: /.*example.com/
      ",
        "mergedExpected": "
      - link:
        - /url: /.*example.com/
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
      - link:
        - /url: /.*other.com/
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
      - textbox:
        - /placeholder: Wrong
      ",
        "mergedExpected": "
      - textbox:
        - /placeholder: Enter name
      ",
        "pass": false,
      }
    `)
  })

  // -- /url: with inner children (link with child elements)
  test('/url: regex match with inner children', () => {
    expect(match(
      '<a href="https://example.com"><strong>Click</strong> here</a>',
      `\
- link:
  - /url: /.*example.com/`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Click here
        - /url: /.*example.com/
      ",
        "expected": "
      - link:
        - /url: /.*example.com/
      ",
        "mergedExpected": "
      - link:
        - /url: /.*example.com/
      ",
        "pass": true,
      }
    `)
  })

  test('/url: regex mismatch with inner children', () => {
    expect(match(
      '<a href="https://example.com"><strong>Click</strong> here</a>',
      `\
- link:
  - /url: /.*other.com/`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Click here
        - /url: https://example.com
      ",
        "expected": "
      - link:
        - /url: /.*other.com/
      ",
        "mergedExpected": "
      - link:
        - text: Click here
        - /url: https://example.com
      ",
        "pass": false,
      }
    `)
  })

  test('/url: regex match with inner children and text template', () => {
    expect(match(
      '<a href="https://example.com"><strong>Click</strong> here</a>',
      `\
- link:
  - text: Click here
  - /url: /.*example.com/`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Click here
        - /url: /.*example.com/
      ",
        "expected": "
      - link:
        - text: Click here
        - /url: /.*example.com/
      ",
        "mergedExpected": "
      - link:
        - text: Click here
        - /url: /.*example.com/
      ",
        "pass": true,
      }
    `)
  })

  test('/url: regex match with inner children and wrong text template', () => {
    expect(match(
      '<a href="https://example.com"><strong>Click</strong> here</a>',
      `\
- link:
  - text: Wrong text
  - /url: /.*example.com/`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Click here
        - /url: https://example.com
      ",
        "expected": "
      - link:
        - text: Wrong text
        - /url: /.*example.com/
      ",
        "mergedExpected": "
      - link:
        - text: Click here
        - /url: https://example.com
      ",
        "pass": false,
      }
    `)
  })

  test('/url: literal match with inner children', () => {
    expect(match(
      '<a href="https://example.com"><strong>Click</strong> here</a>',
      `\
- link:
  - /url: https://example.com`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Click here
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

  test('/url: literal mismatch with inner children', () => {
    expect(match(
      '<a href="https://example.com"><strong>Click</strong> here</a>',
      `\
- link:
  - /url: https://other.com`,
    )).toMatchInlineSnapshot(`
      {
        "actual": "
      - link:
        - text: Click here
        - /url: https://example.com
      ",
        "expected": "
      - link:
        - /url: https://other.com
      ",
        "mergedExpected": "
      - link:
        - text: Click here
        - /url: https://example.com
      ",
        "pass": false,
      }
    `)
  })
})
