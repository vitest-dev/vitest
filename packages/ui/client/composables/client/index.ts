import { createClient, getTasks } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import type { File, ResolvedConfig } from 'vitest'
import { reactive as reactiveVue } from 'vue'
import { createFileTask } from '@vitest/runner/utils'
import type { BrowserRunnerState } from '../../../types'
import { ENTRY_URL, isReport } from '../../constants'
import { parseError } from '../error'
import { activeFileId } from '../params'
import { createStaticClient } from './static'
import { files, testRunState, unhandledErrors } from './state'
import type { UIFile } from '~/composables/client/types'
import { endRun, resumeRun, startRun } from '~/composables/summary'

export { ENTRY_URL, PORT, HOST, isReport } from '../../constants'

export { files, testRunState, unhandledErrors }

export const client = (function createVitestClient() {
  if (isReport) {
    return createStaticClient()
  }
  else {
    let onTaskUpdateCalled = false
    return createClient(ENTRY_URL, {
      reactive: (data, ctxKey) => {
        return ctxKey === 'state' ? reactiveVue(data as any) as any : shallowRef(data)
      },
      handlers: {
        onTaskUpdate() {
          console.log('onTaskUpdate')
          if (testRunState.value === 'idle' && !onTaskUpdateCalled) {
            onTaskUpdateCalled = true
            resumeRun()
          }
          testRunState.value = 'running'
        },
        onFinished(_files, errors) {
          console.log('onFinished', _files?.length, errors?.length)
          endRun()
          testRunState.value = 'idle'
          onTaskUpdateCalled = false
          unhandledErrors.value = (errors || []).map(parseError)
        },
        onFinishedReportCoverage() {
          // reload coverage iframe
          const iframe = document.querySelector('iframe#vitest-ui-coverage')
          if (iframe instanceof HTMLIFrameElement && iframe.contentWindow)
            iframe.contentWindow.location.reload()
        },
      },
    })
  }
})()

export const config = shallowRef<ResolvedConfig>({} as any)
export const status = ref<WebSocketStatus>('CONNECTING')

export const current = computed(() => {
  const currentFileId = activeFileId.value
  const entry = files.value.find(file => file.id === currentFileId)!
  return entry ? findById(entry.id) : undefined
})
export const currentLogs = computed(() => getTasks(current.value).map(i => i?.logs || []).flat() || [])

export function findById(id: string) {
  const file = client.state.idMap.get(id)
  return file ? file as File : undefined
}

export const isConnected = computed(() => status.value === 'OPEN')
export const isConnecting = computed(() => status.value === 'CONNECTING')
export const isDisconnected = computed(() => status.value === 'CLOSED')

export function runAll() {
  return runFiles(client.state.getFiles()/* , true */)
}

function clearResults(useFiles: File[]) {
  // todo: do we need to reflect server result?
  // if so, we need to add a new filtered flag to the ui file and reset it properly
  // we will need to change collect logic in summary.ts
  const map = new Map(files.value.map(i => [i.id, i]))
  useFiles.forEach((f) => {
    delete f.result
    getTasks(f).forEach(i => delete i.result)
    const file = map.get(f.id)
    if (file) {
      file.state = undefined
      file.duration = undefined
      file.collectDuration = undefined
    }
  })
}

export function runFiles(useFiles: File[]/* , fromAll = false */) {
  clearResults(useFiles)

  startRun()

  return client.rpc.rerun(useFiles.map(i => i.filepath))
}

export function runCurrent() {
  if (current.value)
    return runFiles([current.value])
}

// @ts-expect-error not typed global
export const browserState = window.__vitest_browser_runner__ as BrowserRunnerState | undefined

watch(
  () => client.ws,
  (ws) => {
    status.value = isReport ? 'OPEN' : 'CONNECTING'

    ws.addEventListener('open', async () => {
      status.value = 'OPEN'
      client.state.filesMap.clear()
      const [remoteFiles, _config, errors] = await Promise.all([
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
        files.value = remoteFiles.map<UIFile>(file => ({
          id: file.id,
          name: file.name,
          mode: file.mode,
          state: file.result?.state,
          filepath: file.filepath,
          projectName: file.projectName || '',
          collectDuration: file.collectDuration,
          setupDuration: file.setupDuration,
        })).sort((a, b) => {
          return a.name.localeCompare(b.name)
        })
        client.state.collectFiles(remoteFiles)
        // must be after collectFiles
        startRun()
      }
      unhandledErrors.value = (errors || []).map(parseError)
      config.value = _config
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
