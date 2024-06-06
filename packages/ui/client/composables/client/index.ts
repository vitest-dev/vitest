import { createClient, getTasks } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import type { ErrorWithDiff, File, ResolvedConfig } from 'vitest'
import type { Ref } from 'vue'
import { reactive as reactiveVue } from 'vue'
import { createFileTask } from '@vitest/runner/utils'
import type { BrowserRunnerState, RunState } from '../../../types'
import { ENTRY_URL, isReport } from '../../constants'
import { parseError } from '../error'
import { activeFileId } from '../params'
import { createStaticClient } from './static'
import type { UIFile } from '~/composables/client/types'
import { files, testStatus } from '~/composables/tests-status'

export { ENTRY_URL, PORT, HOST, isReport } from '../../constants'

export const testRunState: Ref<RunState> = ref('idle')
export const unhandledErrors: Ref<ErrorWithDiff[]> = ref([])

export { files }

export const client = (function createVitestClient() {
  if (isReport) {
    return createStaticClient()
  }
  else {
    // const callbacks = /* #__PURE__ */ new WeakMap<{ key: string }, () => void>()
    function onCollected(collectedFiles: File[] = [], cb?: () => void) {
      try {
        // trigger update to all files
        collectedFiles.forEach((file) => {
          const entry = files.value.find(f => f.id === file.id)
          if (entry) {
            // callbacks.get({ key: file.id })?.()
            /* const number = */requestAnimationFrame(() => {
              entry.mode = file.mode
              entry.setupDuration = file.setupDuration
              entry.prepareDuration = file.prepareDuration
              entry.environmentLoad = file.environmentLoad
              entry.collectDuration = file.collectDuration
              entry.duration = file.result?.duration
              entry.state = file.result?.state
            })
            // callbacks.set({ key: file.id }, () => cancelAnimationFrame(number))
          }
        })
      }
      finally {
        cb && requestAnimationFrame(cb)
      }
    }
    return createClient(ENTRY_URL, {
      reactive: (data, ctxKey) => {
        return ctxKey === 'state' ? reactiveVue(data as any) as any : data
      },
      handlers: {
        onTaskUpdate(tasks) {
          testRunState.value = 'running'
          tasks.forEach(([id, result]) => {
            if (result) {
              const file = files.value.find(file => file.id === id)
              if (file) {
                requestAnimationFrame(() => {
                  file.state = result.state
                  file.duration = result.duration
                })
              }
            }
          })
        },
        onCollected,
        onFinished(finishedFiles, errors) {
          onCollected(finishedFiles, () => {
            testStatus.end()
            testRunState.value = 'idle'
            unhandledErrors.value = (errors || []).map(parseError)
          })
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

/*
function sort(a: File, b: File) {
  return a.name.localeCompare(b.name)
}
*/

export const config = shallowRef<ResolvedConfig>({} as any)
export const status = ref<WebSocketStatus>('CONNECTING')
// export const files = computed(() => client.state.getFiles().sort(sort))
// export const current = computed(() => files.value.find(file => file.id === activeFileId.value))

/*
export function findById(id: string) {
  return files.value.find(file => file.id === id)
}
*/

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
  return runFiles(client.state.getFiles(), true)
}

function clearResults(useFiles: File[]) {
  const map = new Map(files.value.map(i => [i.id, i]))
  useFiles.forEach((f) => {
    delete f.result
    getTasks(f).forEach(i => delete i.result)
    const file = map.get(f.id)
    if (file)
      file.state = undefined
  })
}

export function runFiles(useFiles: File[], fromAll = false) {
  clearResults(useFiles)

  if (fromAll)
    testStatus.start()
  else
    testStatus.restart()

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
        testStatus.start()
        client.state.collectFiles(remoteFiles)
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
