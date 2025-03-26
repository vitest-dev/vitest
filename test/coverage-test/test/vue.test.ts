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
        "branches": "5/6 (83.33%)",
        "functions": "3/5 (60%)",
        "lines": "40/48 (83.33%)",
        "statements": "40/48 (83.33%)",
      }
    `)
  }
  else if (isV8Provider()) {
    expect(coverageMap).toMatchInlineSnapshot(`
      {
        "branches": "5/6 (83.33%)",
        "functions": "3/5 (60%)",
        "lines": "35/43 (81.39%)",
        "statements": "35/43 (81.39%)",
      }
    `)
  }
  else {
    expect(coverageMap).toMatchInlineSnapshot(`
      {
        "branches": "5/6 (83.33%)",
        "functions": "5/7 (71.42%)",
        "lines": "13/16 (81.25%)",
        "statements": "14/17 (82.35%)",
      }
    `)
  }
})
