// eslint-disable-next-line no-restricted-imports
import type { ResolvedConfig } from 'vitest'
import { parse } from 'flatted'
import { assignVitestGlobals, browserHashMap, client, instantiateRunner, loadConfig } from './utils'
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

ws.addEventListener('message', async (data) => {
  const { event, paths } = parse(data.data)
  if (event === 'run') {
    const config: ResolvedConfig = await loadConfig()

    const waitingPaths = [...paths]
    await runTests(paths, config!, async (e) => {
      if (e.data.type === 'hide') {
        hideIFrames()
        return
      }

      if (e.data.type === 'done') {
        waitingPaths.splice(waitingPaths.indexOf(e.data.filename))
        if (!waitingPaths.length) {
          await rpcDone()
          await rpc().onDone('no-isolate')
        }
        return
      }

      if (e.data.type === 'navigate') {
        // currentModule = e.data.filename
        // button.removeAttribute('disabled')
        // if (!currentModule)
        //   button.setAttribute('disabled', 'true')

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
  const button = document.getElementById('vitest-browser-button') as HTMLButtonElement
  button.addEventListener('click', () => {
    if (currentModule && browserHashMap.has(currentModule)) {
      const hidden = iFrame.classList.contains('hidden')
      button.innerText = hidden ? 'Show Test UI' : 'Hide Test UI'
      iFrame.classList.toggle('hidden')
      const targetIFrame = browserIFrames.get(currentModule)
      targetIFrame?.classList.remove('show')
      testTitle.innerText = ''
      if (!hidden) {
        testTitle.innerText = `${currentModule.replace(/^\/@fs\//, '')}`
        targetIFrame?.classList.add('show')
      }
    }
  })

  window.addEventListener('storage', (e) => {
    if (e.key === 'vueuse-color-scheme')
      document.documentElement.classList.toggle('dark', e.newValue === 'dark')
  })
})

async function runTests(
  paths: string[],
  config: ResolvedConfig,
  navigate: (ev: BroadcastChannelEventMap['message']) => void,
) {
  // need to import it before any other import, otherwise Vite optimizer will hang
  const viteClientPath = '/@vite/client'
  await import(viteClientPath)

  const { channel } = await instantiateRunner()
  channel.addEventListener('message', navigate)

  if (!config.snapshotOptions.snapshotEnvironment)
    config.snapshotOptions.snapshotEnvironment = new BrowserSnapshotEnvironment()

  const now = `${new Date().getTime()}`
  const container = document.getElementById('vitest-browser-runner-container') as HTMLDivElement

  // isolate test on iframes
  paths
    .map(path => (`${config.root}/${path}`).replace(/\/+/g, '/'))
    .forEach((path) => {
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
