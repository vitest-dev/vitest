import type { BrowserTraceData, BrowserTraceEntry } from '../../../packages/browser/src/client/tester/trace'
import { stripVTControlCharacters } from 'node:util'
import { relative } from 'pathe'
import { expect, test } from 'vitest'
import { buildTestProjectTree } from '../../test-utils'
import { instances, provider, runBrowserTests } from './utils'

test('trace view artifacts', async () => {
  const result = await runBrowserTests({
    root: './fixtures/trace',
  })
  const root = result.ctx.config.root

  function formatLocation(location: BrowserTraceEntry['location']) {
    // columns can differ between browsers
    // return `${relative(root, location.file)}:${location.line}:${location.column}`
    return `${relative(root, location.file)}:${location.line}`
  }

  function formatEntry(raw: BrowserTraceEntry) {
    return {
      name: raw.name,
      ...(raw.selector ? { selector: raw.selector } : {}),
      ...(raw.location ? { location: formatLocation(raw.location!) } : {}),
    }
  }

  const projectErrorTree = buildTestProjectTree(result.results, (testCase) => {
    const result = testCase.result()
    return result.state === 'failed'
      ? result.errors.map(e => stripVTControlCharacters(e.message))
      : result.state
  })

  const projectArtifactTree = buildTestProjectTree(result.results, (testCase) => {
    const artifacts = testCase.artifacts()
    const traces = artifacts.map((artifact) => {
      if (artifact.type === 'internal:browserTrace') {
        const data = artifact.data as BrowserTraceData
        return {
          entries: data.entries.map(e => formatEntry(e)),
          ...(data.retry ? { retry: data.retry } : {}),
          ...(data.repeats ? { repeats: data.repeats } : {}),
        }
      }
      return artifact.type
    })
    return traces
  })

  for (const { browser } of instances) {
    expect.soft(projectErrorTree[browser], browser).toMatchInlineSnapshot(`
      {
        "expect.test.ts": {
          "click": "passed",
          "expect.element fail": [
            "expect(element).toHaveTextContent()

      Expected element to have text content:
        World
      Received:
        Hello",
          ],
          "expect.element pass": "passed",
          "failure": [
            "Test failure",
          ],
        },
        "mark.test.ts": {
          "helper": "passed",
          "locator.mark": "passed",
          "mark function": "passed",
          "page.mark": "passed",
          "stack": "passed",
        },
        "retry.test.ts": {
          "repeated retried tests": "passed",
          "repeated test": "passed",
          "repeated test retried on later repeat": "passed",
          "retried test": "passed",
        },
        "styles.test.ts": {
          "inline styles": "passed",
        },
      }
    `)
    // selector format is different between providers
    if (provider.name === 'webdriverio') {
      expect.soft(projectArtifactTree[browser], browser).toMatchInlineSnapshot(`
        {
          "expect.test.ts": {
            "click": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:25",
                    "name": "__vitest_click",
                    "selector": " body > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "expect.element fail": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:15",
                    "name": "expect.element().toHaveTextContent [ERROR]",
                    "selector": " body > button",
                  },
                  {
                    "location": "expect.test.ts:15",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
            ],
            "expect.element pass": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:10",
                    "name": "expect.element().toHaveTextContent",
                    "selector": " body > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "failure": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:20",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
            ],
          },
          "mark.test.ts": {
            "helper": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:24",
                    "name": "render helper",
                    "selector": " body > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "locator.mark": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:10",
                    "name": "button rendered - locator",
                    "selector": " body > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "mark function": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:34",
                    "name": "render group",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "page.mark": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:15",
                    "name": "button rendered - page",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "stack": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:29",
                    "name": "button rendered - stack",
                    "selector": " body > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
          "retry.test.ts": {
            "repeated retried tests": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "retry": 2,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test retried on later repeat": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 1,
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 2,
              },
            ],
            "retried test": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "selector": " body > ul",
                  },
                  {
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "retry": 2,
              },
            ],
          },
          "styles.test.ts": {
            "inline styles": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:7",
                    "name": "button rendered with css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
        }
      `)
    }
    if (provider.name === 'playwright') {
      expect.soft(projectArtifactTree[browser], browser).toMatchInlineSnapshot(`
        {
          "expect.test.ts": {
            "click": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:25",
                    "name": "__vitest_click",
                    "selector": "internal:role=button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "expect.element fail": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:15",
                    "name": "expect.element().toHaveTextContent [ERROR]",
                    "selector": "internal:role=button",
                  },
                  {
                    "location": "expect.test.ts:15",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
            ],
            "expect.element pass": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:10",
                    "name": "expect.element().toHaveTextContent",
                    "selector": "internal:role=button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "failure": [
              {
                "entries": [
                  {
                    "location": "expect.test.ts:20",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
            ],
          },
          "mark.test.ts": {
            "helper": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:24",
                    "name": "render helper",
                    "selector": "internal:role=button[name="Hello"i]",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "locator.mark": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:10",
                    "name": "button rendered - locator",
                    "selector": "internal:role=button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "mark function": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:34",
                    "name": "render group",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "page.mark": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:15",
                    "name": "button rendered - page",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "stack": [
              {
                "entries": [
                  {
                    "location": "mark.test.ts:29",
                    "name": "button rendered - stack",
                    "selector": "internal:role=button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
          "retry.test.ts": {
            "repeated retried tests": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "retry": 2,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test retried on later repeat": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 1,
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "repeats": 2,
              },
            ],
            "retried test": [
              {
                "entries": [
                  {
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask [fail]",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "selector": "internal:role=list",
                  },
                  {
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
                "retry": 2,
              },
            ],
          },
          "styles.test.ts": {
            "inline styles": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:7",
                    "name": "button rendered with css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
        }
      `)
    }
  }
})
