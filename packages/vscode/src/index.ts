import type { ExtensionContext, TestController, TestItem, TestItemCollection, TestRun } from 'vscode'
import { TestMessage, TestRunProfileKind, TestRunRequest, Uri, tests, window } from 'vscode'
import { createClient } from '@vitest/ws-client'
import { WebSocket } from 'ws'
import type { File, Task } from '../../vitest/src/types'

export const PORT = '51204'
export const HOST = [location.hostname, PORT].filter(Boolean).join(':')
export const ENTRY_URL = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${HOST}/__vitest_api__`

export const client = createClient(ENTRY_URL, {
  WebSocketConstructor: WebSocket as any,
})

const tasksMap: Map<string, TestItem> = new Map()

function updateRunState(data: Task, run: TestRun) {
  const item = tasksMap.get(data.id)!
  if (data.mode === 'skip' || data.mode === 'todo') {
    item.busy = false
    run.skipped(item)
  }
  else if (!data.result || data.result.state === 'run') {
    item.busy = true
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
}

function createTaskItem(task: Task, parent: TestItemCollection, controller: TestController, run?: TestRun) {
  const filepath = task.file?.filepath || (task as File).filepath
  const item = parent.get(task.id) || controller.createTestItem(task.id, task.name, Uri.file(filepath))
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
  if (run)
    updateRunState(task, run)
  return item
}

export async function activate(context: ExtensionContext) {
  const output = window.createOutputChannel('Vitest')

  const log = (data: any) => {
    output.appendLine(JSON.stringify(data, null, 2))
  }

  const ctrl = tests.createTestController('vitest', 'Vitest')
  context.subscriptions.push(ctrl)

  const ws = new WebSocket('ws://localhost:51204/__vitest_api__')
  ws.on('message', (buffer) => {
    const msg = JSON.parse(String(buffer))
    log({ msg })
  })
  ws.on('open', () => {
    ws.send('hi')
  })

  ctrl.createRunProfile('Run Tests', TestRunProfileKind.Run, async(request) => {
    const files = request.include?.map(i => i.uri?.fsPath).filter(Boolean) as string[]
    if (files?.length) {
      const run = ctrl.createTestRun(request)
      await client.rpc.rerun(files)
      run.end()
    }
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
