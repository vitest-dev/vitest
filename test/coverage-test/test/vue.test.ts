import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, expect } from 'vitest'
import { isBrowser, isV8Provider, readCoverageMap, runVitest, test } from '../utils'

beforeAll(async () => {
  await runVitest({
    include: ['fixtures/test/vue-fixture.test.ts'],
    coverage: { reporter: ['json', 'html'], all: false },
  })
})

test('files should not contain query parameters', () => {
  const coveragePath = resolve('./coverage/Vue/Counter/')
  const files = readdirSync(coveragePath)

  expect(files).toContain('index.html')
  expect(files).toContain('Counter.vue.html')
  expect(files).toContain('Counter.component.ts.html')
  expect(files).not.toContain('Counter.component.ts?vue&type=script&src=true&lang.ts.html')
})

test('coverage results matches snapshot', async () => {
  const coverageMap = await readCoverageMap()

  if (isV8Provider() && isBrowser()) {
    expect(coverageMap).toMatchInlineSnapshot(`
      {
        "branches": "5/7 (71.42%)",
        "functions": "3/5 (60%)",
        "lines": "39/48 (81.25%)",
        "statements": "39/48 (81.25%)",
      }
    `)
  }
  else if (isV8Provider()) {
    expect(coverageMap).toMatchInlineSnapshot(`
      {
        "branches": "5/7 (71.42%)",
        "functions": "3/5 (60%)",
        "lines": "38/47 (80.85%)",
        "statements": "38/47 (80.85%)",
      }
    `)
  }
  else {
    expect(coverageMap).toMatchInlineSnapshot(`
      {
        "branches": "6/8 (75%)",
        "functions": "5/7 (71.42%)",
        "lines": "14/17 (82.35%)",
        "statements": "15/18 (83.33%)",
      }
    `)
  }
})
