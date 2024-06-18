import type { WorkerGlobalState } from 'vitest'
import { parse } from 'flatted'
import { getBrowserState } from '../utils'

const config = getBrowserState().config

const providedContext = parse(getBrowserState().providedContext)

const state: WorkerGlobalState = {
  ctx: {
    pool: 'browser',
    worker: './browser.js',
    workerId: 1,
    config,
    projectName: config.name || '',
    files: [],
    environment: {
      name: 'browser',
      options: null,
    },
    providedContext,
    invalidates: [],
  },
  onCancel: null as any,
  mockMap: new Map(),
  config,
  environment: {
    name: 'browser',
    transformMode: 'web',
    setup() {
      throw new Error('Not called in the browser')
    },
  },
  moduleCache: getBrowserState().moduleCache,
  rpc: null as any,
  durations: {
    environment: 0,
    prepare: performance.now(),
  },
  providedContext,
}

// @ts-expect-error not typed global
globalThis.__vitest_browser__ = true
// @ts-expect-error not typed global
globalThis.__vitest_worker__ = state
