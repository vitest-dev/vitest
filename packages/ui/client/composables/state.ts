import { createClient } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import { reactive } from 'vue'
import { pickTasksFromFile } from '../utils'

export const client = createClient('ws://localhost:51204/__vitest_api__', {
  reactive: reactive as any,
})

export const status = ref<WebSocketStatus>('CONNECTING')

client.waitForConnection().then(async() => {
  status.value = 'OPEN'
  client.state.collectFiles(await client.rpc.getFiles())
})

client.ws.addEventListener('close', () => {
  status.value = 'CLOSED'
})

export const files = computed(() => client.state.getFiles())
export const activeFileIdRef = ref('')
export const current = computed(() => files.value.find(file => file.id === activeFileIdRef.value))
export const tasks = computed(() => {
  const file = current.value
  if (file)
    return pickTasksFromFile(file)
  return null
})
