import type { ExtensionContext, TestController, TestItem, TestItemCollection, TestRun } from 'vscode'
import { TestMessage, TestRunProfileKind, TestRunRequest, Uri, tests } from 'vscode'
import { createClient } from '@vitest/ws-client'
import { WebSocket } from 'ws'
import type { File, Task } from '../../vitest/src/types'

export const PORT = '51204'
export const HOST = ['127.0.0.1', PORT].filter(Boolean).join(':')
export const ENTRY_URL = `ws://${HOST}/__vitest_api__`

let currentRun: TestRun | undefined
let ctrl: TestController
const tasksMap: Map<string, TestItem> = new Map()

function getRun() {
  if (!currentRun) {
    currentRun = ctrl.createTestRun(new TestRunRequest())
    tasksMap.clear()
  }
  return currentRun
}

const client = createClient(ENTRY_URL, {
  WebSocketConstructor: WebSocket as any,
  handlers: {
    onTaskUpdate(packs) {
      const run = getRun()
      for (const [id] of packs) {
        if (client.state.idMap.get(id))
          updateRunState(client.state.idMap.get(id)!, run)
      }
    },
    onFinished() {
      if (currentRun) {
        currentRun.end()
        currentRun = undefined
      }
    },
    onCollected(files) {
      if (!files)
        return
      const run = getRun()
      files.forEach((file) => {
        createTaskItem(file, ctrl.items, ctrl, run)
      })
    },
  },
})

function updateRunState(data: Task, run: TestRun) {
  const item = tasksMap.get(data.id)!
  if (data.mode === 'skip' || data.mode === 'todo') {
    item.busy = false
    run.skipped(item)
  }
  else if (data.result?.state === 'pass') {
    item.busy = false
    run.passed(item, data.result.duration)
  }
  else if (data.result?.state === 'fail') {
    item.busy = false
    run.failed(
      item,
      new TestMessage(String(data.result.error)),
      data.result.duration,
    )
  }
  else {
    item.busy = true
  }
}

function createTaskItem(task: Task, parent: TestItemCollection, controller: TestController, run: TestRun) {
  const filepath = task.file?.filepath || (task as File).filepath
  const item = controller.createTestItem(task.id, task.name, Uri.file(filepath))
  parent.add(item)
  tasksMap.set(task.id, item)
  if (task.type === 'test') {
    item.canResolveChildren = false
  }
  else {
    task.tasks.forEach((t) => {
      createTaskItem(t, item.children, controller, run)
    })
  }
  updateRunState(task, run)

  return item
}

export async function activate(context: ExtensionContext) {
  // const output = window.createOutputChannel('Vitest')

  ctrl = tests.createTestController('vitest', 'Vitest')
  context.subscriptions.push(ctrl)

  ctrl.createRunProfile('Run Tests', TestRunProfileKind.Run, async(request) => {
    const files = request.include?.map(i => i.uri?.fsPath).filter(Boolean) as string[]
    if (files?.length)
      await client.rpc.rerun(files)
  }, true)

  ctrl.resolveHandler = async(item) => {
    if (!item) {
      const run = ctrl.createTestRun(new TestRunRequest(), 'hi')
      const files = await client.rpc.getFiles()
      Object.values(files).forEach((file) => {
        createTaskItem(file, ctrl.items, ctrl, run)
      })
      run.end()
    }
  }
}

export function deactivate() {}
