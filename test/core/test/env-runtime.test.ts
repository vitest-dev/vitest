import { expect, test, vi } from 'vitest'
import { populateGlobal } from '../../../packages/vitest/src/integrations/env/utils'

test('returns valid globals', () => {
  const globalEvent = vi.fn()
  const winEvent = vi.fn()
  const global = {
    Event: globalEvent,
  }
  const win = { Event: winEvent }
  const { originals } = populateGlobal(global, win)
  expect(originals.get('Event')?.value).toBe(globalEvent)
  expect(win.Event).toBe(winEvent)
  expect(global.Event).toBe(winEvent)
})

test('keeps DOM storage implementations when Node provides web storage globals (Node 25+)', () => {
  // Simulate Node 25+, where `localStorage`/`sessionStorage` are lazy
  // accessors on globalThis (they warn or return undefined without
  // `--localstorage-file`)
  let nativeGetterCalls = 0
  const nativeGet = () => {
    nativeGetterCalls++
    return undefined
  }
  const global: any = {}
  Object.defineProperty(global, 'localStorage', { get: nativeGet, configurable: true, enumerable: true })
  Object.defineProperty(global, 'sessionStorage', { get: nativeGet, configurable: true, enumerable: true })

  const localStorage = { getItem: vi.fn() }
  const sessionStorage = { getItem: vi.fn() }
  const win = { localStorage, sessionStorage }

  const { keys, originals } = populateGlobal(global, win)

  expect(global.localStorage).toBe(localStorage)
  expect(global.sessionStorage).toBe(sessionStorage)
  // capturing the originals must not invoke Node's lazy getter
  expect(nativeGetterCalls).toBe(0)

  // teardown, same as the jsdom/happy-dom environments
  keys.forEach(key => delete global[key])
  originals.forEach((d, k) => Object.defineProperty(global, k, d))

  // the native accessor is restored intact
  expect(Object.getOwnPropertyDescriptor(global, 'localStorage')?.get).toBe(nativeGet)
  expect(nativeGetterCalls).toBe(0)
})
