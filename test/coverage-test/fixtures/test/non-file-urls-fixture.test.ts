// @ts-expect-error - virtual module provided by the fixture's Vite plugin
import { nonFileGreet } from 'virtual:non-file-url-source'
import { expect, test } from 'vitest'

test('imports a virtual module that reports a non-file: URL to V8', () => {
  expect(nonFileGreet()).toBe('rsc')
})
