import { createClient, getTasks } from '@vitest/ws-client'
import type { WebSocketStatus } from '@vueuse/core'
import type { File, SerializedConfig, Task, TaskResultPack } from 'vitest'
import { reactive as reactiveVue } from 'vue'
import { createFileTask } from '@vitest/runner/utils'
import type { BrowserRunnerState } from '../../../types'
import { parseError } from '../error'
import { activeFileId } from '../params'
import { createStaticClient } from './static'
import { testRunState, unhandledErrors } from './state'
import { ui } from '~/composables/api'
import { ENTRY_URL, isReport } from '~/constants'
import { explorerTree } from '~/composables/explorer'
import { isFileNode } from '~/composables/explorer/utils'
import { isSuite as isTaskSuite } from '~/utils/task'

export { ENTRY_URL, PORT, HOST, isReport } from '~/constants'

export const client = (function createVitestClient() {
  if (isReport) {
    return createStaticClient()
  }
  else {
    return createClient(ENTRY_URL, {
      reactive: (data, ctxKey) => {
        return ctxKey === 'state' ? reactiveVue(data as any) as any : shallowRef(data)
      },
      handlers: {
        onTaskUpdate(packs: TaskResultPack[]) {
          explorerTree.resumeRun(packs)
          testRunState.value = 'running'
        },
        onFinished(_files, errors) {
          explorerTree.endRun()
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

export const config = shallowRef<SerializedConfig>({} as any)
export const status = ref<WebSocketStatus>('CONNECTING')

export const current = computed(() => {
  const currentFileId = activeFileId.value
  return currentFileId ? findById(currentFileId) : undefined
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

function clearTaskResult(patterns: string[], task: Task) {
  patterns.push(task.id)
  delete task.result
  const node = explorerTree.nodes.get(task.id)
  if (node) {
    node.state = undefined
    node.duration = undefined
    if (isTaskSuite(task)) {
      for (const t of task.tasks) {
        clearTaskResult(patterns, t)
      }
    }
  }
}

function clearResults(useFiles: File[]) {
  const map = explorerTree.nodes
  useFiles.forEach((f) => {
    delete f.result
    getTasks(f).forEach((i) => {
      delete i.result
      if (map.has(i.id)) {
        const task = map.get(i.id)
        if (task) {
          task.state = undefined
          task.duration = undefined
        }
      }
    })
    const file = map.get(f.id)
    if (file) {
      file.state = undefined
      file.duration = undefined
      if (isFileNode(file)) {
        file.collectDuration = undefined
      }
    }
  })
}

export function runFiles(useFiles: File[]) {
  clearResults(useFiles)

  explorerTree.startRun()

  return client.rpc.rerun(useFiles.map(i => i.filepath))
}

export function runTestOrSuite(task: Task) {
  const ids: string[] = []
  clearTaskResult(ids, task)

  // we also need to send the parent ids: the state doesn't have the parent ids
  let parent = explorerTree.nodes.get(task.id)?.parentId
  while (parent) {
    const node = explorerTree.nodes.get(parent)
    if (node) {
      const parentTask = client.state.idMap.get(node.id)
      if (parentTask) {
        ids.unshift(parentTask.id)
        delete parentTask.result
        node.state = undefined
        node.duration = undefined
      }
      else {
        break
      }
      parent = explorerTree.nodes.get(node.id)?.parentId
    }
    else {
      break
    }
  }

  explorerTree.startRun()

  return client.rpc.rerunTestOrSuite(task.file.filepath, ids)
}

export function runCurrent() {
  if (current.value) {
    return runFiles([current.value])
  }
}

// for testing during dev
// export const browserState: BrowserRunnerState = {
//   files: [],
//   config: {},
//   type: 'orchestrator',
//   wrapModule: () => {},
// }
// @ts-expect-error not typed global
export const browserState = window.__vitest_browser_runner__ as
  | BrowserRunnerState
  | undefined

// @ts-expect-error not typed global
window.__vitest_ui_api__ = ui

watch(
  () => client.ws,
  (ws) => {
    status.value = isReport ? 'OPEN' : 'CONNECTING'

    ws.addEventListener('open', async () => {
      status.value = 'OPEN'
      client.state.filesMap.clear()
      let [files, _config, errors] = await Promise.all([
        client.rpc.getFiles(),
        client.rpc.getConfig(),
        client.rpc.getUnhandledErrors(),
      ])
      if (_config.standalone) {
        const filenames = await client.rpc.getTestFiles()
        files = filenames.map(([{ name, root }, filepath]) => {
          const file = createFileTask(filepath, root, name)
          file.mode = 'skip'
          return file
        })
      }
      explorerTree.loadFiles(files)
      client.state.collectFiles(files)
      explorerTree.startRun()
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
