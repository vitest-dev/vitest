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
  const root = result.ctx!.config.root

  function formatLocation(location: BrowserTraceEntry['location']) {
    // columns can differ between browsers
    // return `${relative(root, location.file)}:${location.line}:${location.column}`
    return `${relative(root, location!.file)}:${location!.line}`
  }

  function formatEntry(raw: BrowserTraceEntry) {
    // snapshot only stable data.
    // other integration features need to be tested separately
    const result = {
      ...raw,
      location: raw.location ? formatLocation(raw.location) : undefined,
      stack: undefined,
      startTime: undefined,
      duration: undefined,
      snapshot: {
        selectorResolution: raw.snapshot.selectorResolution,
        selectorError: raw.snapshot.selectorError,
      },
    }
    // remove noisy undefined properties
    for (const _key in result) {
      const key = _key as keyof typeof result
      if (result[key] === undefined) {
        delete result[key]
      }
      if (result[key] && typeof result[key] === 'object') {
        for (const subKey in result[key]) {
          if ((result as any)[key][subKey] === undefined) {
            delete (result as any)[key][subKey]
          }
        }
      }
    }
    return result
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
          "canvas pixels are captured for replay": "passed",
          "custom element dom shape is rebuilt without runtime behavior": "passed",
          "shadow dom is rebuilt and highlightable by mirror id": "passed",
        },
        "expect.test.ts": {
          "click": "passed",
          "click fail": [
            "Click failed (normalized)",
          ],
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
          "same-origin image is inlined for offline replay": "passed",
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
          "snapshot-time pseudo-state styles": "passed",
          "style tag css is inlined": "passed",
        },
        "viewport.test.ts": {
          "document scroll is restored from trace metadata": "passed",
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
                    "element": {
                      "_pwSelector": "internal:role=button",
                      "locator": "getByRole('button')",
                      "selector": "html > body > button",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:58",
                    "name": "button rendered with adopted stylesheet",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:51",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "canvas pixels are captured for replay": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:testid=[data-testid="trace-canvas"s]",
                      "locator": "getByTestId('trace-canvas')",
                      "selector": "html > body > canvas",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:17",
                    "name": "canvas drawn before mark",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:11",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "custom element dom shape is rebuilt without runtime behavior": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button[name="Custom element button"i]",
                      "locator": "getByRole('button', { name: 'Custom element button' })",
                      "selector": ">>>html > body > trace-widget > button",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:47",
                    "name": "custom element rendered",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:32",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "shadow dom is rebuilt and highlightable by mirror id": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button[name="Shadow button"i]",
                      "locator": "getByRole('button', { name: 'Shadow button' })",
                      "selector": ">>>html > body > section > button",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:28",
                    "name": "shadow button rendered",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:20",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "element": {
                      "_pwSelector": "internal:role=button[name="Hello"i]",
                      "locator": "getByRole('button', { name: 'Hello' })",
                      "selector": "html > body > button",
                    },
                    "kind": "action",
                    "location": "expect.test.ts:25",
                    "name": "vitest:click",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:23",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "click fail": [
              {
                "entries": [
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:33",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
            ],
            "expect.element fail": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button",
                      "locator": "getByRole('button')",
                      "selector": "html > body > button",
                    },
                    "kind": "expect",
                    "location": "expect.test.ts:15",
                    "name": "toHaveTextContent [ERROR]",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "fail",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:15",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
            ],
            "expect.element pass": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button",
                      "locator": "getByRole('button')",
                      "selector": "html > body > button",
                    },
                    "kind": "expect",
                    "location": "expect.test.ts:10",
                    "name": "toHaveTextContent",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:8",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "failure": [
              {
                "entries": [
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:20",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
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
                    "element": {
                      "_pwSelector": "internal:role=button[name="Hello"i]",
                      "locator": "getByRole('button', { name: 'Hello' })",
                      "selector": "html > body > button",
                    },
                    "kind": "mark",
                    "location": "mark.test.ts:24",
                    "name": "render helper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:23",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "locator.mark": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button",
                      "locator": "getByRole('button')",
                      "selector": "html > body > button",
                    },
                    "kind": "mark",
                    "location": "mark.test.ts:10",
                    "name": "button rendered - locator",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:8",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "mark function": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "mark.test.ts:34",
                    "name": "render group",
                    "snapshot": {},
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:33",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "page.mark": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "mark.test.ts:15",
                    "name": "button rendered - page",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:13",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "stack": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button",
                      "locator": "getByRole('button')",
                      "selector": "html > body > button",
                    },
                    "kind": "mark",
                    "location": "mark.test.ts:29",
                    "name": "button rendered - stack",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:27",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "element": {
                      "_pwSelector": "internal:attr=[alt="external trace asset"i]",
                      "locator": "getByAltText('external trace asset')",
                      "selector": "html > body > img",
                    },
                    "kind": "mark",
                    "location": "resources.test.ts:20",
                    "name": "image rendered from external url",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "resources.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "same-origin image is inlined for offline replay": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:attr=[alt="local trace asset"i]",
                      "locator": "getByAltText('local trace asset')",
                      "selector": "html > body > img",
                    },
                    "kind": "mark",
                    "location": "resources.test.ts:12",
                    "name": "image rendered from same-origin url",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "resources.test.ts:9",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:28",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "retry": 2,
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:28",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:28",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test retried on later repeat": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:35",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:35",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 1,
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:35",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 2,
              },
            ],
            "retried test": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=list",
                      "locator": "getByRole('list')",
                      "selector": "html > body > ul",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:21",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "kind": "mark",
                    "location": "styles.test.ts:51",
                    "name": "element rendered with css url resource",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:45",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "external stylesheet remains url dependent": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:62",
                    "name": "button rendered with external stylesheet",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:55",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "font files remain url dependent": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:80",
                    "name": "button rendered with font-face url",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:66",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "inline styles": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:11",
                    "name": "button rendered with css",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:9",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "same-origin link css is inlined": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:41",
                    "name": "button rendered with same-origin linked css",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:32",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "snapshot-time pseudo-state styles": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button[name="First pseudo state"i]",
                      "locator": "getByRole('button', { name: 'First pseudo state' })",
                      "selector": "html > body > button:nth-child(1)",
                    },
                    "kind": "expect",
                    "location": "styles.test.ts:101",
                    "name": "toHaveStyle",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "_pwSelector": "internal:role=button[name="First pseudo state"i]",
                      "locator": "getByRole('button', { name: 'First pseudo state' })",
                      "selector": "html > body > button:nth-child(1)",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:104",
                    "name": "vitest:hover",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "_pwSelector": "internal:role=button[name="Second pseudo state"i]",
                      "locator": "getByRole('button', { name: 'Second pseudo state' })",
                      "selector": "html > body > button:nth-child(2)",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:105",
                    "name": "vitest:click",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "_pwSelector": "internal:label="Focused pseudo state"i",
                      "locator": "getByLabel('Focused pseudo state')",
                      "selector": "html > body > input",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:106",
                    "name": "vitest:fill",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "_pwSelector": "internal:label="Focus within pseudo state"i",
                      "locator": "getByLabel('Focus within pseudo state')",
                      "selector": "html > body > label > input",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:107",
                    "name": "vitest:fill",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:83",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "style tag css is inlined": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:29",
                    "name": "button rendered with style tag css",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:14",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
          },
          "viewport.test.ts": {
            "document scroll is restored from trace metadata": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:role=button",
                      "locator": "getByRole('button')",
                      "selector": "html > body > main > button",
                    },
                    "kind": "mark",
                    "location": "viewport.test.ts:31",
                    "name": "document scrolled before mark",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "viewport.test.ts:24",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "overflow element scroll is stored in snapshot payload": [
              {
                "entries": [
                  {
                    "element": {
                      "_pwSelector": "internal:testid=[data-testid="scroll-box"s]",
                      "locator": "getByTestId('scroll-box')",
                      "selector": "html > body > section",
                    },
                    "kind": "mark",
                    "location": "viewport.test.ts:47",
                    "name": "overflow container scrolled before mark",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "viewport.test.ts:34",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "viewport media query depends on replay viewport": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "viewport.test.ts:21",
                    "name": "viewport sensitive layout rendered",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "viewport.test.ts:10",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "element": {
                      "locator": "getByRole('button')",
                      "selector": "internal:role=button",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:58",
                    "name": "button rendered with adopted stylesheet",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:51",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "canvas pixels are captured for replay": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByTestId('trace-canvas')",
                      "selector": "internal:testid=[data-testid="trace-canvas"s]",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:17",
                    "name": "canvas drawn before mark",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:11",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "custom element dom shape is rebuilt without runtime behavior": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button', { name: 'Custom element button' })",
                      "selector": "internal:role=button[name="Custom element button"i]",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:47",
                    "name": "custom element rendered",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:32",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "shadow dom is rebuilt and highlightable by mirror id": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button', { name: 'Shadow button' })",
                      "selector": "internal:role=button[name="Shadow button"i]",
                    },
                    "kind": "mark",
                    "location": "exotic.test.ts:28",
                    "name": "shadow button rendered",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "exotic.test.ts:20",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "element": {
                      "locator": "getByRole('button')",
                      "selector": "internal:role=button",
                    },
                    "kind": "action",
                    "location": "expect.test.ts:25",
                    "name": "vitest:click",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:23",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "click fail": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button', { name: 'Missing' })",
                      "selector": "internal:role=button[name="Missing"i]",
                    },
                    "kind": "action",
                    "location": "expect.test.ts:33",
                    "name": "vitest:click",
                    "snapshot": {
                      "selectorResolution": "missing",
                    },
                    "status": "fail",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:33",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
            ],
            "expect.element fail": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button')",
                      "selector": "internal:role=button",
                    },
                    "kind": "expect",
                    "location": "expect.test.ts:15",
                    "name": "toHaveTextContent [ERROR]",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "fail",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:15",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
            ],
            "expect.element pass": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button')",
                      "selector": "internal:role=button",
                    },
                    "kind": "expect",
                    "location": "expect.test.ts:10",
                    "name": "toHaveTextContent",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:8",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "failure": [
              {
                "entries": [
                  {
                    "kind": "lifecycle",
                    "location": "expect.test.ts:20",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
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
                    "element": {
                      "locator": "getByRole('button', { name: 'Hello' })",
                      "selector": "internal:role=button[name="Hello"i]",
                    },
                    "kind": "mark",
                    "location": "mark.test.ts:24",
                    "name": "render helper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:23",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "locator.mark": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button')",
                      "selector": "internal:role=button",
                    },
                    "kind": "mark",
                    "location": "mark.test.ts:10",
                    "name": "button rendered - locator",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:8",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "mark function": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "mark.test.ts:34",
                    "name": "render group",
                    "snapshot": {},
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:33",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "page.mark": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "mark.test.ts:15",
                    "name": "button rendered - page",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:13",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "stack": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button')",
                      "selector": "internal:role=button",
                    },
                    "kind": "mark",
                    "location": "mark.test.ts:29",
                    "name": "button rendered - stack",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "mark.test.ts:27",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "element": {
                      "locator": "getByAltText('external trace asset')",
                      "selector": "internal:attr=[alt="external trace asset"i]",
                    },
                    "kind": "mark",
                    "location": "resources.test.ts:20",
                    "name": "image rendered from external url",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "resources.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "same-origin image is inlined for offline replay": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByAltText('local trace asset')",
                      "selector": "internal:attr=[alt="local trace asset"i]",
                    },
                    "kind": "mark",
                    "location": "resources.test.ts:12",
                    "name": "image rendered from same-origin url",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "resources.test.ts:9",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:31",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:28",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "retry": 2,
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:28",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:29",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:28",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:18",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:17",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 2,
              },
            ],
            "repeated test retried on later repeat": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:35",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:38",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
                "repeats": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:35",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 1,
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:36",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:35",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
                "repeats": 2,
              },
            ],
            "retried test": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:24",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "fail",
                  },
                ],
                "retry": 1,
              },
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('list')",
                      "selector": "internal:role=list",
                    },
                    "kind": "mark",
                    "location": "retry.test.ts:22",
                    "name": "renderHelper",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "retry.test.ts:21",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
                    "kind": "mark",
                    "location": "styles.test.ts:51",
                    "name": "element rendered with css url resource",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:45",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "external stylesheet remains url dependent": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:62",
                    "name": "button rendered with external stylesheet",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:55",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "font files remain url dependent": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:80",
                    "name": "button rendered with font-face url",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:66",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "inline styles": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:11",
                    "name": "button rendered with css",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:9",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "same-origin link css is inlined": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:41",
                    "name": "button rendered with same-origin linked css",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:32",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "snapshot-time pseudo-state styles": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button', { name: 'First pseudo state' })",
                      "selector": "internal:role=button[name="First pseudo state"i]",
                    },
                    "kind": "expect",
                    "location": "styles.test.ts:101",
                    "name": "toHaveStyle",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "locator": "getByRole('button', { name: 'First pseudo state' })",
                      "selector": "internal:role=button[name="First pseudo state"i]",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:104",
                    "name": "vitest:hover",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "locator": "getByRole('button', { name: 'Second pseudo state' })",
                      "selector": "internal:role=button[name="Second pseudo state"i]",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:105",
                    "name": "vitest:click",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "locator": "getByRole('textbox', { name: 'Focused pseudo state' })",
                      "selector": "internal:role=textbox[name="Focused pseudo state"i]",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:106",
                    "name": "vitest:fill",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "element": {
                      "locator": "getByRole('textbox', { name: 'Focus within pseudo state' })",
                      "selector": "internal:role=textbox[name="Focus within pseudo state"i]",
                    },
                    "kind": "action",
                    "location": "styles.test.ts:107",
                    "name": "vitest:fill",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                    "status": "pass",
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:83",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "style tag css is inlined": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "styles.test.ts:29",
                    "name": "button rendered with style tag css",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "styles.test.ts:14",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
          },
          "viewport.test.ts": {
            "document scroll is restored from trace metadata": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByRole('button')",
                      "selector": "internal:role=button",
                    },
                    "kind": "mark",
                    "location": "viewport.test.ts:31",
                    "name": "document scrolled before mark",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "viewport.test.ts:24",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "overflow element scroll is stored in snapshot payload": [
              {
                "entries": [
                  {
                    "element": {
                      "locator": "getByTestId('scroll-box')",
                      "selector": "internal:testid=[data-testid="scroll-box"s]",
                    },
                    "kind": "mark",
                    "location": "viewport.test.ts:47",
                    "name": "overflow container scrolled before mark",
                    "snapshot": {
                      "selectorResolution": "matched",
                    },
                  },
                  {
                    "kind": "lifecycle",
                    "location": "viewport.test.ts:34",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
                  },
                ],
              },
            ],
            "viewport media query depends on replay viewport": [
              {
                "entries": [
                  {
                    "kind": "mark",
                    "location": "viewport.test.ts:21",
                    "name": "viewport sensitive layout rendered",
                    "snapshot": {},
                  },
                  {
                    "kind": "lifecycle",
                    "location": "viewport.test.ts:10",
                    "name": "vitest:onAfterRetryTask",
                    "snapshot": {},
                    "status": "pass",
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
