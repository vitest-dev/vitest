import { test as baseTest, expect, inject } from 'vitest';
import { server } from '@vitest/browser/context'

const test = baseTest.extend({
  // chromium should inject the value as "true"
  // firefox doesn't provide this value in the config, it will stay undefined
  providedVar: [undefined, { injected: true }]
})

test('html injected', ({ providedVar }) => {
  // window.HTML_INJECTED_VAR is injected only for chromium via a script in customTester.html
  console.log(`[${server.config.name}] HTML_INJECTED_VAR is ${window.HTML_INJECTED_VAR}`)
  expect(providedVar).toBe(window.HTML_INJECTED_VAR)
})

test.runIf(server.config.name === 'firefox')('[firefox] firefoxValue injected', ({ providedVar }) => {
  expect(providedVar).toBeUndefined()
  expect(inject('firefoxValue')).toBe(true)
})

test.runIf(server.config.name === 'chromium')('[chromium] firefoxValue is not injected', () => {
  expect(inject('firefoxValue')).toBeUndefined()
})