import { createClient } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import type { File } from 'vitest'
import type { Ref } from 'vue'
import { pickTasksFromFile } from './utils'

export const client = await createClient('ws://localhost:51204/__vitest_api__', {
  onStart() {
    // console.log('onStart', files)
  },
})

export const files = ref(await client.rpc.getFiles()) as Ref<File[]>

export const activeFileIdRef = ref('')

// TODO: reflect to really state
export const status = ref<WebSocketStatus>('OPEN')

export const current = computed(() => files.value.find(file => file.id === activeFileIdRef.value))
export const tasks = computed(() => {
  const file = current.value
  if (file)
    return pickTasksFromFile(file)
  return null
})
