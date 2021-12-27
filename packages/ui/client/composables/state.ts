import { createClient } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import { reactive } from 'vue'
import type { ResolvedConfig } from '#types'

export const ENTRY_URL = 'ws://localhost:51204/__vitest_api__'

export const client = createClient(ENTRY_URL, {
  reactive: reactive as any,
})

export const config = shallowRef<ResolvedConfig>({} as any)
export const status = ref<WebSocketStatus>('CONNECTING')
export const files = computed(() => client.state.getFiles())
export const activeFileIdRef = ref('')
export const current = computed(() => files.value.find(file => file.id === activeFileIdRef.value))

watch(
  () => client.ws,
  (ws) => {
    status.value = 'CONNECTING'

    ws.addEventListener('open', () => {
      status.value = 'OPEN'
      client.rpc.getFiles().then(files => client.state.collectFiles(files))
      client.rpc.getConfig().then(_config => config.value = _config)
    })

    ws.addEventListener('close', () => {
      status.value = 'CLOSED'
    })
  },
  { immediate: true },
)
