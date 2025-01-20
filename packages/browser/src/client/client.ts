import type { CancelReason } from '@vitest/runner'
import { createClient } from '@vitest/ws-client'

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${
  location.protocol === 'https:' ? 'wss:' : 'ws:'
}//${HOST}/__vitest_api__?token=${(window as any).VITEST_API_TOKEN}`

let setCancel = (_: CancelReason) => {}
export const onCancel = new Promise<CancelReason>((resolve) => {
  setCancel = resolve
})

export const client = createClient(ENTRY_URL, {
  handlers: {
    onCancel: setCancel,
  },
})

export const channel = new BroadcastChannel('vitest')
