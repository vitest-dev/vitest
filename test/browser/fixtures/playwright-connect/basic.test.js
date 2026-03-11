import { test, expect } from 'vitest';

test('[playwright] Run basic test in browser via connect mode', () => {
  expect(1).toBe(1)
})

test('[playwright] Run browser-only test in browser via connect mode', () => {
  const element = document.createElement("div")
  expect(element instanceof HTMLDivElement).toBe(true)
  expect(element instanceof HTMLElement).toBe(true)
  expect(element instanceof HTMLInputElement).not.toBe(true)
})

test('[playwright] applies launch options from connect header', () => {
  expect(navigator.userAgent).toContain('VitestLaunchOptionsTester')
})
