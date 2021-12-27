import { createClient } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import type { File } from 'vitest'
import type { Ref } from 'vue'
import { pickTasksFromFile } from './utils'

export const client = createClient('ws://localhost:51204/__vitest_api__')
client.state.filesMap = reactive(client.state.filesMap)
client.state.idMap = reactive(client.state.idMap)

export const files = ref([]) as Ref<File[]>

export const status = ref<WebSocketStatus>('CONNECTING')

client.waitForConnection().then(async() => {
  status.value = 'OPEN'
  const rawFiles = await client.rpc.getFiles()
  files.value = rawFiles
})

client.ws.addEventListener('close', () => {
  status.value = 'CLOSED'
})

export const activeFileIdRef = ref('')
export const current = computed(() => files.value.find(file => file.id === activeFileIdRef.value))
export const tasks = computed(() => {
  const file = current.value
  if (file)
    return pickTasksFromFile(file)
  return null
})
