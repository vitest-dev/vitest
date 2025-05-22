import { vi } from 'vitest'
import { JSDOM } from 'jsdom'

// Setup DOM environment similar to other Vitest tests
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
    url: 'http://localhost:3000',
    pretendToBeVisual: true,
    resources: 'usable'
})

// Setup globals
Object.defineProperty(global, 'document', {
    value: dom.window.document,
    writable: true,
})

Object.defineProperty(global, 'window', {
    value: dom.window,
    writable: true,
})

// Setup HTMLElement and other DOM classes
global.HTMLElement = dom.window.HTMLElement
global.HTMLIFrameElement = dom.window.HTMLIFrameElement
global.Element = dom.window.Element
global.Node = dom.window.Node
global.MutationObserver = dom.window.MutationObserver

// Mock performance and crypto APIs
global.performance = {
    now: vi.fn(() => Date.now()),
} as any

global.crypto = {
    randomUUID: vi.fn(() => Math.random().toString(36).substring(2, 15)),
} as any

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((cb) => setTimeout(cb, 16))
global.cancelAnimationFrame = vi.fn((id) => clearTimeout(id))