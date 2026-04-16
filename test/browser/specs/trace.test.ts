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
        "exotic.test.ts": {
          "adopted stylesheets are not captured by snapshot alone": "passed",
          "canvas pixels are not captured by default": "passed",
          "custom element dom shape is rebuilt without runtime behavior": "passed",
          "shadow dom is rebuilt and highlightable by mirror id": "passed",
        },
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
        "resources.test.ts": {
          "external image remains url dependent": "passed",
          "same-origin image remains url dependent": "passed",
        },
        "retry.test.ts": {
          "repeated retried tests": "passed",
          "repeated test": "passed",
          "repeated test retried on later repeat": "passed",
          "retried test": "passed",
        },
        "styles.test.ts": {
          "css url resources stay as urls": "passed",
          "external stylesheet remains url dependent": "passed",
          "font files remain url dependent": "passed",
          "inline styles": "passed",
          "same-origin link css is inlined": "passed",
          "style tag css is inlined": "passed",
        },
        "viewport.test.ts": {
          "document scroll is not stored in snapshot payload": "passed",
          "overflow element scroll is stored in snapshot payload": "passed",
          "viewport media query depends on replay viewport": "passed",
        },
      }
    `)
    // selector format is different between providers
    if (provider.name === 'webdriverio') {
      expect.soft(projectArtifactTree[browser], browser).toMatchInlineSnapshot(`
        {
          "exotic.test.ts": {
            "adopted stylesheets are not captured by snapshot alone": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:55",
                    "name": "button rendered with adopted stylesheet",
                    "selector": " body > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "canvas pixels are not captured by default": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:18",
                    "name": "canvas drawn before mark",
                    "selector": " body > canvas",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "custom element dom shape is rebuilt without runtime behavior": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:44",
                    "name": "custom element rendered",
                    "selector": ">>>html > body > trace-widget > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "shadow dom is rebuilt and highlightable by mirror id": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:27",
                    "name": "shadow button rendered",
                    "selector": ">>>html > body > section > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
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
          "resources.test.ts": {
            "external image remains url dependent": [
              {
                "entries": [
                  {
                    "location": "resources.test.ts:17",
                    "name": "image rendered from external url",
                    "selector": " body > img",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "same-origin image remains url dependent": [
              {
                "entries": [
                  {
                    "location": "resources.test.ts:11",
                    "name": "image rendered from same-origin url",
                    "selector": " body > img",
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
            "css url resources stay as urls": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:40",
                    "name": "element rendered with css url resource",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "external stylesheet remains url dependent": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:51",
                    "name": "button rendered with external stylesheet",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "font files remain url dependent": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:69",
                    "name": "button rendered with font-face url",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "inline styles": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:11",
                    "name": "button rendered with css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "same-origin link css is inlined": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:30",
                    "name": "button rendered with same-origin linked css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "style tag css is inlined": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:20",
                    "name": "button rendered with style tag css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
          "viewport.test.ts": {
            "document scroll is not stored in snapshot payload": [
              {
                "entries": [
                  {
                    "location": "viewport.test.ts:33",
                    "name": "document scrolled before mark",
                    "selector": " body > main > button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "overflow element scroll is stored in snapshot payload": [
              {
                "entries": [
                  {
                    "location": "viewport.test.ts:49",
                    "name": "overflow container scrolled before mark",
                    "selector": " body > section",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "viewport media query depends on replay viewport": [
              {
                "entries": [
                  {
                    "location": "viewport.test.ts:22",
                    "name": "viewport sensitive layout rendered",
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
          "exotic.test.ts": {
            "adopted stylesheets are not captured by snapshot alone": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:55",
                    "name": "button rendered with adopted stylesheet",
                    "selector": "internal:role=button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "canvas pixels are not captured by default": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:18",
                    "name": "canvas drawn before mark",
                    "selector": "internal:testid=[data-testid="trace-canvas"s]",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "custom element dom shape is rebuilt without runtime behavior": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:44",
                    "name": "custom element rendered",
                    "selector": "internal:role=button[name="Custom element button"i]",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "shadow dom is rebuilt and highlightable by mirror id": [
              {
                "entries": [
                  {
                    "location": "exotic.test.ts:27",
                    "name": "shadow button rendered",
                    "selector": "internal:role=button[name="Shadow button"i]",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
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
          "resources.test.ts": {
            "external image remains url dependent": [
              {
                "entries": [
                  {
                    "location": "resources.test.ts:17",
                    "name": "image rendered from external url",
                    "selector": "internal:attr=[alt="external trace asset"i]",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "same-origin image remains url dependent": [
              {
                "entries": [
                  {
                    "location": "resources.test.ts:11",
                    "name": "image rendered from same-origin url",
                    "selector": "internal:attr=[alt="local trace asset"i]",
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
            "css url resources stay as urls": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:40",
                    "name": "element rendered with css url resource",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "external stylesheet remains url dependent": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:51",
                    "name": "button rendered with external stylesheet",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "font files remain url dependent": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:69",
                    "name": "button rendered with font-face url",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "inline styles": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:11",
                    "name": "button rendered with css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "same-origin link css is inlined": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:30",
                    "name": "button rendered with same-origin linked css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "style tag css is inlined": [
              {
                "entries": [
                  {
                    "location": "styles.test.ts:20",
                    "name": "button rendered with style tag css",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
          },
          "viewport.test.ts": {
            "document scroll is not stored in snapshot payload": [
              {
                "entries": [
                  {
                    "location": "viewport.test.ts:33",
                    "name": "document scrolled before mark",
                    "selector": "internal:role=button",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "overflow element scroll is stored in snapshot payload": [
              {
                "entries": [
                  {
                    "location": "viewport.test.ts:49",
                    "name": "overflow container scrolled before mark",
                    "selector": "internal:testid=[data-testid="scroll-box"s]",
                  },
                  {
                    "name": "vitest:onAfterRetryTask [pass]",
                  },
                ],
              },
            ],
            "viewport media query depends on replay viewport": [
              {
                "entries": [
                  {
                    "location": "viewport.test.ts:22",
                    "name": "viewport sensitive layout rendered",
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
