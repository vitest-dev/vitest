import type { ResolvedConfig } from 'vitest'
import { parse } from 'flatted'
import {
  assignVitestGlobals,
  browserHashMap,
  client,
  instantiateRunner,
  loadConfig,
  onCancel,
} from './utils'
import { rpc, rpcDone } from './rpc'
import { BrowserSnapshotEnvironment } from './snapshot'

// @ts-expect-error mocking some node apis
globalThis.process = { env: {}, argv: [], cwd: () => '/', stdout: { write: () => {} }, nextTick: cb => cb() }
globalThis.global = globalThis

let currentModule: string | undefined
let currentModuleLeft: number | undefined
const browserIFrames = new Map<string, HTMLIFrameElement>()

const url = new URL(location.href)

const ws = client.ws
const testTitle = document.getElementById('vitest-browser-runner-tester') as HTMLDivElement

function hideIFrames() {
  for (const [, targetIFrame] of browserIFrames.entries())
    targetIFrame.classList.remove('show')

  currentModule = undefined
  currentModuleLeft = undefined
}

function activateIFrame(useCurrentModule: string, left?: number) {
  const targetIFrame = browserIFrames.get(useCurrentModule)
  if (targetIFrame && typeof left === 'number') {
    targetIFrame.style.left = `${left + 14}px`
    targetIFrame.style.width = `${window.innerWidth - left - 28}px`
    if (!targetIFrame.classList.contains('show')) {
      testTitle.innerText = `${useCurrentModule.replace(/^\/@fs\//, '')}`
      requestAnimationFrame(() => targetIFrame.classList.add('show'))
    }
  }
}
function normalizePaths(config: ResolvedConfig, paths: string[]) {
  return paths
    .map((path) => {
      if (path.startsWith('/@fs/'))
        return path

      if (path.startsWith(config.root))
        return path

      return `${config.root}/${path}`.replace(/\/+/g, '/')
    })
}

let listenToRun = false

ws.addEventListener('message', async (data) => {
  if (!listenToRun)
    return

  const { event, paths } = parse(data.data)
  if (event === 'run' && paths?.length)
    await handleRunTests(paths)
})

ws.addEventListener('open', async () => {
  await assignVitestGlobals()

  const iFrame = document.getElementById('vitest-ui') as HTMLIFrameElement
  iFrame.setAttribute('src', `${url.pathname}/__vitest__/`.replace('//', '/'))

  window.addEventListener('storage', (e) => {
    if (e.key === 'vueuse-color-scheme')
      document.documentElement.classList.toggle('dark', e.newValue === 'dark')
  })

  const paths = await client.rpc.getPaths()

  // resolve Vitest browser promise
  await client.rpc.initializeBrowser()

  await handleRunTests(paths)
})

async function runTests(
  paths: string[],
  config: ResolvedConfig,
  listener?: (ev: BroadcastChannelEventMap['message']) => void,
) {
  // need to import it before any other import, otherwise Vite optimizer will hang
  const viteClientPath = '/@vite/client'
  await import(viteClientPath)

  const { channel, runner } = await instantiateRunner()
  if (listener) {
    channel.removeEventListener('message', listener)
    channel.addEventListener('message', listener)
  }

  function removeBrowserChannel() {
    listener && channel.removeEventListener('message', listener)
    ws.close()
    channel.close()
  }

  window.removeEventListener('beforeunload', removeBrowserChannel)
  window.addEventListener('beforeunload', removeBrowserChannel)

  onCancel.then((reason) => {
    runner?.onCancel?.(reason)
  })

  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()

  const now = `${new Date().getTime()}`
  const container = document.getElementById('vitest-browser-runner-container') as HTMLDivElement

  const normalizedPaths = normalizePaths(config, paths)

  const cleanup = normalizedPaths.filter(path => browserHashMap.has(path))

  if (cleanup.length)
    cleanup.forEach(path => channel.postMessage({ type: 'disconnect', filename: path }))

  // isolate test on iframes
  normalizedPaths.forEach((path) => {
    // don't hide iframes here, we only need to reload changed tests modules
    if (browserIFrames.has(path)) {
      browserIFrames.get(path)!.classList.remove('show')
      container.removeChild(browserIFrames.get(path)!)
      browserIFrames.delete(path)
    }
    browserHashMap.set(path, [true, now])
    const iFrame = document.createElement('iframe')
    iFrame.setAttribute('loading', 'eager')
    // requires Access-Control-Allow-Origin: '*' on every resource
    // iFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-popups allow-forms')
    iFrame.classList.add('iframe-test')
    iFrame.setAttribute(
      'src',
      `${url.pathname}/__vitest_test__/${path}.html?browserv=${now}`.replace('//', '/'),
    )
    browserIFrames.set(path, iFrame)
    container.appendChild(iFrame)
  })

  if (currentModule) {
    const savedCurrentModule = currentModule
    const savedCurrentModuleLeft = currentModuleLeft
    hideIFrames()
    currentModule = savedCurrentModule
    currentModuleLeft = savedCurrentModuleLeft
    activateIFrame(savedCurrentModule, savedCurrentModuleLeft)
  }
}

async function handleRunTests(paths: string[]) {
  const config = await loadConfig()

  const waitingPaths = normalizePaths(config, paths)

  await runTests(paths, config!, async (e) => {
    if (e.data.type === 'hide') {
      hideIFrames()
      return
    }

    if (e.data.type === 'done') {
      const filename = e.data.filename
      if (!filename)
        return

      const idx = waitingPaths.indexOf(filename)
      if (idx === -1)
        return

      waitingPaths.splice(idx, 1)

      if (!waitingPaths.length) {
        await rpcDone()
        await rpc().onDone('no-isolate')
        listenToRun = true
      }
      return
    }

    if (e.data.type === 'navigate') {
      if (!currentModule || !e.data.filename || currentModule !== e.data.filename)
        hideIFrames()

      currentModule = e.data.filename
      if (!currentModule)
        return

      currentModuleLeft = e.data.position
      activateIFrame(currentModule, currentModuleLeft)
    }
  })
}
