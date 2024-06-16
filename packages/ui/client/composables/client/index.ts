import { createClient, getTasks } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import type { ErrorWithDiff, File, ResolvedConfig } from 'vitest'
import type { Ref } from 'vue'
import { reactive } from 'vue'
import { createFileTask } from '@vitest/runner/utils'
import type { BrowserRunnerState, RunState } from '../../../types'
import { ENTRY_URL, isReport } from '../../constants'
import { parseError } from '../error'
import { activeFileId } from '../params'
import { createStaticClient } from './static'

export { ENTRY_URL, PORT, HOST, isReport } from '../../constants'

export const testRunState: Ref<RunState> = ref('idle')
export const unhandledErrors: Ref<ErrorWithDiff[]> = ref([])

export const client = (function createVitestClient() {
  if (isReport) {
    return createStaticClient()
  }
  else {
    return createClient(ENTRY_URL, {
      reactive: reactive as any,
      handlers: {
        onTaskUpdate() {
          testRunState.value = 'running'
        },
        onFinished(_files, errors) {
          testRunState.value = 'idle'
          unhandledErrors.value = (errors || []).map(parseError)
        },
        onFinishedReportCoverage() {
          // reload coverage iframe
          const iframe = document.querySelector('iframe#vitest-ui-coverage')
          if (iframe instanceof HTMLIFrameElement && iframe.contentWindow) {
            iframe.contentWindow.location.reload()
          }
        },
      },
    })
  }
})()

function sort(a: File, b: File) {
  return a.name.localeCompare(b.name)
}

export const config = shallowRef<ResolvedConfig>({} as any)
export const status = ref<WebSocketStatus>('CONNECTING')
export const files = computed(() => client.state.getFiles().sort(sort))
export const current = computed(() =>
  files.value.find(file => file.id === activeFileId.value),
)
export const currentLogs = computed(
  () =>
    getTasks(current.value)
      .map(i => i?.logs || [])
      .flat() || [],
)

export function findById(id: string) {
  return files.value.find(file => file.id === id)
}

export const isConnected = computed(() => status.value === 'OPEN')
export const isConnecting = computed(() => status.value === 'CONNECTING')
export const isDisconnected = computed(() => status.value === 'CLOSED')

export function runAll(files = client.state.getFiles()) {
  return runFiles(files)
}

export function runFiles(files: File[]) {
  files.forEach((f) => {
    delete f.result
    getTasks(f).forEach(i => delete i.result)
  })
  return client.rpc.rerun(files.map(i => i.filepath))
}

export function runCurrent() {
  if (current.value) {
    return runFiles([current.value])
  }
}

// @ts-expect-error not typed global
export const browserState = window.__vitest_browser_runner__ as
  | BrowserRunnerState
  | undefined

watch(
  () => client.ws,
  (ws) => {
    status.value = isReport ? 'OPEN' : 'CONNECTING'

    ws.addEventListener('open', async () => {
      status.value = 'OPEN'
      client.state.filesMap.clear()
      const [files, _config, errors] = await Promise.all([
        client.rpc.getFiles(),
        client.rpc.getConfig(),
        client.rpc.getUnhandledErrors(),
      ])
      if (_config.standalone) {
        const filenames = await client.rpc.getTestFiles()
        const files = filenames.map<File>(([{ name, root }, filepath]) => {
          return /* #__PURE__ */ createFileTask(filepath, root, name)
        })
        client.state.collectFiles(files)
      }
      else {
        client.state.collectFiles(files)
      }
      unhandledErrors.value = (errors || []).map(parseError)
      config.value = _config
    })

    ws.addEventListener('close', () => {
      setTimeout(() => {
        if (status.value === 'CONNECTING') {
          status.value = 'CLOSED'
        }
      }, 1000)
    })
  },
  { immediate: true },
)

// display the first file on init
// if (!activeFileId.value) {
//   const stop = watch(
//     () => client.state.getFiles(),
//     (files) => {
//       if (activeFileId.value) {
//         stop()
//         return
//       }
//
//       if (files.length && files[0].id) {
//         activeFileId.value = files[0].id
//         stop()
//       }
//     },
//     { immediate: true },
//   )
// }
