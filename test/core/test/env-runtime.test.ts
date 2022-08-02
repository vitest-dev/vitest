import { populateGlobal } from 'vitest/src/integrations/env/utils'
import { expect, test, vi } from 'vitest'

test('returns valid globals', () => {
  const globalEvent = vi.fn()
  const winEvent = vi.fn()
  const global = {
    Event: globalEvent,
  }
  const win = { Event: winEvent }
  const { originals } = populateGlobal(global, win)
  expect(originals.get('Event')).toBe(globalEvent)
  expect(win.Event).toBe(winEvent)
  expect(global.Event).toBe(winEvent)
})
