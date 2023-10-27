// @vitest-environment jsdom

import { expect, test } from 'vitest'

const nodeMajor = Number(process.version.slice(1).split('.')[0])

test.runIf(nodeMajor >= 15)('MessageChannel and MessagePort are available', () => {
  expect(MessageChannel).toBeDefined()
  expect(MessagePort).toBeDefined()
})

test.runIf(nodeMajor >= 17)('structuredClone is available', () => {
  expect(structuredClone).toBeDefined()
})

test.runIf(nodeMajor >= 18)('fetch, Request, Response, and BroadcastChannel are available', () => {
  expect(fetch).toBeDefined()
  expect(Request).toBeDefined()
  expect(Response).toBeDefined()
  expect(TextEncoder).toBeDefined()
  expect(TextDecoder).toBeDefined()
  expect(BroadcastChannel).toBeDefined()
})
