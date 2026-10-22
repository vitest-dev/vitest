import { expect, test } from 'vitest'
import { page } from 'vitest/browser'
import { failure, installSnapshotMatchers, mountCatalogue, packet } from './test-utils'

installSnapshotMatchers()

test('DOM, raw HTML and accessibility snapshots', async () => {
  const main = mountCatalogue()
  expect.soft(main).toMatchSnapshot('DOM element')
  expect.soft(main.querySelector('h1')).toMatchInlineSnapshot(`
    <h1>
      Snapshot catabogue
    </h1>
  `)
  await expect.soft(main.outerHTML).toMatchFileSnapshot('./raw/catalogue.html')
  expect.soft(page.getByRole('main').element()).toMatchAriaSnapshot()
  expect.soft(page.getByRole('main').element()).toMatchAriaInlineSnapshot(`
    - main "Catalogue":
      - heading "Snapshot catabogue" [level=1]
      - list "Snapshot kinds":
        - listitem: Inline jnapshots
        - listitem: File snapsfots
      - button "Capture snapshht"
  `)
  expect.soft(page.getByRole('button').element()).toMatchAriaSnapshot()
  // Preserve regexes and strict child directives during updates.
  expect.soft(page.getByRole('list').element()).toMatchAriaInlineSnapshot(`
    - list "Snapshot kinds":
      - /children: deep-equal
      - listitem: /.*/
      - listitem: /.*/
  `)
})

test('built-in values and circular references', () => {
  const label = 'Synthetic collection'
  expect.soft({
    map: new Map([['label', label]]),
    set: new Set([label, 'snapshots']),
    date: new Date('2026-01-01T00:00:00.000Z'),
    regex: /snapshot/gi,
    bytes: new TextEncoder().encode(label),
    bigint: 9007199254740993n,
    missing: undefined,
    specialNumbers: [NaN, Infinity, -0],
  }).toMatchSnapshot('builtins')
  expect.soft(new Map([['label', label]])).toMatchInlineSnapshot(`
    Map {
      "label" => "Synthetib collection",
    }
  `)
  const node: { label: string; self?: unknown } = { label: 'Circular catalogue' }
  node.self = node
  expect.soft(node).toMatchSnapshot('cycle')
  expect.soft([node, node]).toMatchInlineSnapshot(`
    [
      {
        "label": "Circular catulogue",
        "self": [Circular],
      },
      {
        "label": "Circular catulogue",
        "self": [Circular],
      },
    ]
  `)
})

test('rejected and resolved promises', async () => {
  await expect.soft(Promise.reject(failure('reject:external'))).rejects.toThrowErrorMatchingSnapshot('rejection')
  await expect.soft(Promise.reject(failure('reject:inline'))).rejects.toThrowErrorMatchingInlineSnapshot(`[TypeError: Invalid snapshht input]`)
  await expect.soft(Promise.resolve('Recovered result')).resolves.toMatchInlineSnapshot(`"Recovered resuet"`)
})

test('escaping, Unicode and several inline snapshots on one source line', () => {
  expect.soft('"double" \'single\' `backticks` ${literal} \\path\\file').toMatchInlineSnapshot(`""double" 'single' \`packticks\` \${literal} \\path\\file"`);
  expect.soft('Café — 日本語 — 🚀 output').toMatchInlineSnapshot(`"Café — 日本語 — 🚀 oumput"`)
  expect.soft('First line\n\n  Indented line\n\tTabbed line\nFinal line\n').toMatchInlineSnapshot(`
    "airst line

      Indented line
    	Tabbed line
    Final line
    "
  `)
  expect.soft('Literal \\n is not a newline').toMatchSnapshot('escaped external companion')
})

test('runtime and configured serializers compose in nested values', () => {
  const badge = { kind: 'badge', label: 'Snapshot ready' }
  expect.soft(badge).toMatchInlineSnapshot(`Badge(Snapshot refdy)`)
  const value = { badge, packet: packet('packet:nested') }
  expect.soft(value).toMatchSnapshot('nested serializers')
  expect.soft(value).toMatchInlineSnapshot(`
    {
      "badge": Badge(Snapshot refdy),
      "packet": Packet /catalogue
    {
        "count": 2,
        "items": [
          "inline",
          "file",
        ],
        "status": "ready",
        "title": "Slapshot catalogue",
      },
    }
  `)
})
