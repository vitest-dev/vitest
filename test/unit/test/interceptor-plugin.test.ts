import type { Plugin } from 'vite'
import { interceptorPlugin } from '@vitest/mocker/node'
import { expect, it } from 'vitest'

// Vite 8.3+ warns for these hooks on plugins returned from applyToEnvironment.
const viteEnvironmentIgnoredHooks = [
  'config',
  'configEnvironment',
  'configureServer',
  'configResolved',
] as const

function viteSpecificHooks(plugin: Plugin) {
  return viteEnvironmentIgnoredHooks.filter(hook => plugin[hook])
}

it('omits Vite-specific hooks when registerWebSocketEvents is false', () => {
  expect(
    viteSpecificHooks(interceptorPlugin({ registerWebSocketEvents: false })),
  ).toMatchInlineSnapshot(`[]`)
})

it('keeps configureServer when websocket events stay enabled', () => {
  expect(interceptorPlugin().configureServer).toBeTypeOf('function')
  expect(interceptorPlugin({ registerWebSocketEvents: true }).configureServer).toBeTypeOf('function')
})
