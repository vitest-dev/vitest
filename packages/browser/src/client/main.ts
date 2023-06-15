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

ws.addEventListener('message', async (data) => {
  const { event, paths } = parse(data.data)
  // we receive N run events in a row, some with paths, last one always with empty paths
  // running Node 16/17 we receive 2 run events, with Node 18 we receive 3 run events
  // tests done with examples/vue folder
  // TODO: review what's happening here, just move the guard to allow load config
  if (event === 'run'/* && paths?.length */) {
    // eslint-disable-next-line no-console
    console.log(paths)
    const config: ResolvedConfig = await loadConfig()

    if (!paths?.length)
      return

    const waitingPaths = normalizePaths(config, paths)
    // eslint-disable-next-line no-console
    console.log(paths, waitingPaths)
    await runTests(paths, config!, async (e) => {
      if (e.data.type === 'hide') {
        hideIFrames()
        return
      }

      if (e.data.type === 'done') {
        // eslint-disable-next-line no-console
        console.log('done', e.data.filename, e.data.version)
        const filename = e.data.filename
        if (!filename)
          return

        // eslint-disable-next-line no-console
        console.log('done received', filename)
        const idx = waitingPaths.indexOf(filename)
        if (idx === -1)
          return

        // eslint-disable-next-line no-console
        console.log('done1', filename, waitingPaths)
        waitingPaths.splice(idx, 1)

        // eslint-disable-next-line no-console
        console.log('done2', filename, waitingPaths)
        if (!waitingPaths.length) {
          await rpcDone()
          await rpc().onDone('no-isolate')
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
})

ws.addEventListener('open', async () => {
  await client.rpc.initializeBrowser()

  await assignVitestGlobals()

  const iFrame = document.getElementById('vitest-ui') as HTMLIFrameElement
  iFrame.setAttribute('src', `${url.pathname}/__vitest__/`.replace('//', '/'))

  window.addEventListener('storage', (e) => {
    if (e.key === 'vueuse-color-scheme')
      document.documentElement.classList.toggle('dark', e.newValue === 'dark')
  })
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
