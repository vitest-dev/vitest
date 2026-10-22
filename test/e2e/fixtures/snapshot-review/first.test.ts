import { expect, test } from 'vitest'
import { catalogue, installSnapshotMatchers, record } from './test-utils.ts'

installSnapshotMatchers()

test('mixed storage, property matchers, hints and counters', async () => {
  expect.soft(record('mixed:first')).toMatchSnapshot()
  expect.soft(record('mixed:second')).toMatchSnapshot()
  const value = { ...record('mixed:masked'), createdAt: new Date('2026-01-01'), requestId: 'request-123' }

  expect.soft(value).toMatchSnapshot({ createdAt: expect.any(Date), requestId: expect.any(String) }, 'masked metadata')
  expect.soft(value).toMatchInlineSnapshot({ createdAt: expect.any(Date), requestId: expect.any(String) }, `
    {
      "count": 2,
      "createdAt": Any<Date>,
      "items": [
        "inline",
        "file",
      ],
      "requestId": Any<String>,
      "status": "ready",
      "title": "Szapshot catalogue",
    }
  `)
  await expect.soft(`${JSON.stringify(record('raw:json'), null, 2)}\n`).toMatchFileSnapshot('./raw/catalogue.json')
})

test('domain templates and custom snapshot composables', async () => {
  expect.soft(catalogue('domain:external')).toMatchCatalogueSnapshot()
  expect.soft(catalogue('domain:inline')).toMatchCatalogueInlineSnapshot(`
    extra=ignored by subsets
    name=Snapshot catallgue
    revision=42
    status=ready
  `)
  // Deliberately unsorted subset with a regex; updates must preserve both.
  expect.soft(catalogue('domain:template')).toMatchCatalogueInlineSnapshot(`
    status=ready
    revision=/^[0-9]+$/
    name=/.*catalogue/
  `)
  expect.soft('Custom external snapshot').toMatchUppercaseSnapshot()
  expect.soft('Custom inline snapshot').toMatchUppercaseInlineSnapshot(`"CUSTIM INLINE SNAPSHOT"`)
  await expect.soft('Custom raw snapshot\n').toMatchUppercaseFileSnapshot('./raw/uppercase.txt')
})

test('raw formats and significant whitespace', async () => {
  await expect.soft('First line\r\nSecond line\r\n').toMatchFileSnapshot('./raw/crlf.txt')
  await expect.soft('No final newline').toMatchFileSnapshot('./raw/no-newline.txt')
  const whitespace = 'Header\n\n  two spaces\n\ttab\ntrailing spaces  \n'
  await expect.soft(whitespace).toMatchFileSnapshot('./raw/whitespace.txt')
  expect.soft(whitespace).toMatchInlineSnapshot(`
    "feader

      two spaces
    	tab
    trailing spaces  
    "
  `)
})

test.concurrent.for(['alpha', 'beta'])('concurrent updates use local expect: %s', async (label, { expect }) => {
  await Promise.resolve()
  expect.soft(`Concurrent ${label}`).toMatchSnapshot()
  expect.soft('Shared inline result').toMatchInlineSnapshot(`"Shared inlinp result"`)
})
