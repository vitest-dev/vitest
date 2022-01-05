import { createClient } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import { reactive } from 'vue'
import { getTasks } from '../../../vitest/src/utils/tasks'
import { activeFileId } from './params'
import type { File, ResolvedConfig } from '#types'

export const PORT = import.meta.hot ? '51204' : location.port
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${HOST}/__vitest_api__`

export const client = createClient(ENTRY_URL, {
  reactive: reactive as any,
})

export const config = shallowRef<ResolvedConfig>({} as any)
export const status = ref<WebSocketStatus>('CONNECTING')
export const files = computed(() => client.state.getFiles())
export const current = computed(() => files.value.find(file => file.id === activeFileId.value))

export const findById = (id: string) => {
  return files.value.find(file => file.id === id)
}

export const isConnected = computed(() => status.value === 'OPEN')
export const isConnecting = computed(() => status.value === 'CONNECTING')
export const isDisconned = computed(() => status.value === 'CLOSED')

export function runAll() {
  return runFiles(client.state.getFiles())
}

export function runFiles(files: File[]) {
  files.forEach((f) => {
    delete f.result
    getTasks(f).forEach(i => delete i.result)
  })
  return client.rpc.rerun(files.map(i => i.filepath))
}

export function runCurrent() {
  if (current.value)
    return runFiles([current.value])
}

watch(
  () => client.ws,
  (ws) => {
    status.value = 'CONNECTING'

    ws.addEventListener('open', () => {
      status.value = 'OPEN'
      client.state.filesMap.clear()
      client.rpc.getFiles().then(files => client.state.collectFiles(files))
      client.rpc.getConfig().then(_config => config.value = _config)
    })

    ws.addEventListener('close', () => {
      setTimeout(() => {
        if (status.value === 'CONNECTING')
          status.value = 'CLOSED'
      }, 1000)
    })
  },
  { immediate: true },
)
