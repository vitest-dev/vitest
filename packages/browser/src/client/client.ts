import type { CancelReason } from '@vitest/runner'
import { createClient } from '@vitest/ws-client'
import type { VitestBrowserClientMocker } from './mocker'
import { getBrowserState } from './utils'

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__`

let setCancel = (_: CancelReason) => {}
export const onCancel = new Promise<CancelReason>((resolve) => {
  setCancel = resolve
})

export const client = createClient(ENTRY_URL, {
  handlers: {
    onCancel: setCancel,
    async startMocking(id: string) {
      // @ts-expect-error not typed global
      const mocker = __vitest_mocker__ as VitestBrowserClientMocker
      const exports = await mocker.resolve(id)
      return Object.keys(exports)
    },
    getTestContext() {
      const state = getBrowserState()
      if (!state)
        return null
      return {
        files: state.files,
      }
    },
  },
})

export const channel = new BroadcastChannel('vitest')
