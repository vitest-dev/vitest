import type { WebSocketStatus } from '@vueuse/core'
import type {
  RunnerTask,
  RunnerTaskEventPack,
  RunnerTaskResultPack,
  RunnerTestFile,
  SerializedRootConfig,
  TestAnnotation,
} from 'vitest'
import type { BrowserRunnerState } from '../../../types'
import type { VitestClientTransport } from './ws'
import { computed, reactive as reactiveVue, ref, shallowRef, watch } from 'vue'
import { explorerTree } from '~/composables/explorer'
import { isFileNode } from '~/composables/explorer/utils'
import { isSuite as isTaskSuite } from '~/utils/task'
import { createFileTask, getTasks } from '../../../../vitest/src/utils/tasks'
import { ui } from '../../composables/api'
import { ENTRY_URL, isReport } from '../../constants'
import { parseError } from '../error'
import { activeFileId } from '../params'
import { StateManager, testRunState, unhandledErrors } from './state'
import { createStaticClient } from './static'
import { createWsClient } from './ws'

export { isReport } from '../../constants'

export interface VitestClient extends VitestClientTransport {
  state: StateManager
}

const state = reactiveVue(new StateManager()) as StateManager
if (isReport) {
  state.filesMap = reactiveVue(state.filesMap) as StateManager['filesMap']
  state.idMap = reactiveVue(state.idMap) as StateManager['idMap']
}
else {
  state.filesMap = shallowRef(state.filesMap) as unknown as StateManager['filesMap']
  state.idMap = shallowRef(state.idMap) as unknown as StateManager['idMap']
}

function createVitestClient(): VitestClient {
  let transport: VitestClientTransport
  if (isReport) {
    transport = createStaticClient()
  }
  else {
    transport = createWsClient(ENTRY_URL, {
      reactive: reactiveVue as any,
      handlers: {
        onTestAnnotate(testId: string, annotation: TestAnnotation) {
          explorerTree.recordTestArtifact(testId, { type: 'internal:annotation', annotation, location: annotation.location })
        },
        onTestArtifactRecord(testId, artifact) {
          explorerTree.recordTestArtifact(testId, artifact)
        },
        onSpecsCollected(specs, startTime) {
          specs?.forEach(([config, file]) => {
            state.clearFiles({ config }, [file])
          })
          explorerTree.startTime = startTime || performance.now()
        },
        onCollected(files) {
          state.collectFiles(files)
        },
        onTaskUpdate(packs: RunnerTaskResultPack[], events: RunnerTaskEventPack[]) {
          state.updateTasks(packs)
          explorerTree.resumeRun(packs, events)
          testRunState.value = 'running'
        },
        onUserConsoleLog(log) {
          state.updateUserLog(log)
        },
        onFinished(_files, errors, _coverage, executionTime) {
          explorerTree.endRun(executionTime)
          // don't change the testRunState.value here:
          // - when saving the file in the codemirror requires explorer tree endRun to finish (multiple microtasks)
          // - if we change here the state before the tasks states are updated, the cursor position will be lost
          // - line moved to composables/explorer/collector.ts::refreshExplorer after calling updateRunningTodoTests
          // testRunState.value = 'idle'
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
  return Object.assign(transport, { state })
}

export const client: VitestClient = createVitestClient()

export const config = shallowRef<Partial<SerializedRootConfig>>({} as any)
const status = ref<WebSocketStatus>('CONNECTING')
export const availableProjects = shallowRef<string[]>([])

export const current = computed(() => {
  const currentFileId = activeFileId.value
  return currentFileId ? findById(currentFileId) : undefined
})
export const currentLogs = computed(() => getTasks(current.value).map(i => i?.logs || []).flat() || [])

export function findById(id: string) {
  const file = client.state.idMap.get(id)
  return file ? file as RunnerTestFile : undefined
}

export const isConnected = computed(() => status.value === 'OPEN')
export const isConnecting = computed(() => status.value === 'CONNECTING')

export function runAll() {
  return runFiles(client.state.getFiles())
}

function clearTaskResult(task: RunnerTask) {
  delete task.result
  const node = explorerTree.nodes.get(task.id)
  if (node) {
    node.state = undefined
    // update task mode to allow change icon on skipped tests
    task.mode = 'run'
    node.duration = undefined
    if (isTaskSuite(task)) {
      for (const t of task.tasks) {
        clearTaskResult(t)
      }
    }
  }
}

function clearResults(useFiles: RunnerTestFile[]) {
  const map = explorerTree.nodes
  useFiles.forEach((f) => {
    delete f.result
    getTasks(f).forEach((i) => {
      delete i.result
      if (map.has(i.id)) {
        const task = map.get(i.id)
        if (task) {
          task.state = undefined
          task.mode = 'run'
          task.duration = undefined
        }
      }
    })
    const file = map.get(f.id)
    if (file) {
      file.state = undefined
      file.mode = 'run'
      file.duration = undefined
      if (isFileNode(file)) {
        file.collectDuration = undefined
      }
    }
  })
}

export function runFiles(useFiles: RunnerTestFile[]) {
  clearResults(useFiles)

  explorerTree.startRun()

  return client.rpc.rerun(useFiles.map(i => i.filepath), true)
}

export function runTask(task: RunnerTask) {
  clearTaskResult(task)

  explorerTree.startRun()

  return client.rpc.rerunTask(task.id)
}

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
      const projects = _config.projects.map(project => ({
        name: project.name || '',
        color: project.color,
      }))
      if (_config.standalone) {
        const filenames = await client.rpc.getTestFiles()
        files = filenames.map(([{ name, root }, filepath]) => {
          const file = createFileTask(filepath, root, name)
          file.mode = 'skip'
          return file
        })
      }
      availableProjects.value = projects.map(p => p.name)
      explorerTree.loadFiles(files, projects)
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
