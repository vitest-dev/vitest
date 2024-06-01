import type { ResolvedConfig } from 'vitest'
import { generateHash } from '@vitest/runner/utils'
import { relative } from 'pathe'
import { channel, client } from './client'
import { rpcDone } from './rpc'
import { getBrowserState, getConfig } from './utils'
import { getUiAPI } from './ui'

const url = new URL(location.href)

const ID_ALL = '__vitest_all__'

const iframes = new Map<string, HTMLIFrameElement>()

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false')
    client.rpc.debug(...args.map(String))
}

function createIframe(container: HTMLDivElement, file: string) {
  if (iframes.has(file)) {
    container.removeChild(iframes.get(file)!)
    iframes.delete(file)
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('loading', 'eager')
  iframe.setAttribute('src', `${url.pathname}__vitest_test__/__test__/${encodeURIComponent(file)}`)
  iframe.setAttribute('data-vitest', 'true')

  iframe.style.display = 'block'
  iframe.style.border = 'none'
  iframe.style.pointerEvents = 'none'
  iframe.setAttribute('allowfullscreen', 'true')
  iframe.setAttribute('allow', 'clipboard-write;')

  iframes.set(file, iframe)
  container.appendChild(iframe)
  return iframe
}

async function done() {
  await rpcDone()
  await client.rpc.finishBrowserTests()
}

interface IframeDoneEvent {
  type: 'done'
  filenames: string[]
}

interface IframeErrorEvent {
  type: 'error'
  error: any
  errorType: string
  files: string[]
}

type IframeChannelEvent = IframeDoneEvent | IframeErrorEvent

async function getContainer(config: ResolvedConfig): Promise<HTMLDivElement> {
  if (config.browser.ui) {
    const element = document.querySelector('#tester-ui')
    if (!element) {
      return new Promise<HTMLDivElement>((resolve) => {
        setTimeout(() => {
          resolve(getContainer(config))
        }, 30)
      })
    }
    return element as HTMLDivElement
  }
  return document.querySelector('#vitest-tester') as HTMLDivElement
}

client.ws.addEventListener('open', async () => {
  const config = getConfig()
  const testFiles = getBrowserState().files

  debug('test files', testFiles.join(', '))

  // TODO: fail tests suite because no tests found?
  if (!testFiles.length) {
    await done()
    return
  }

  const container = await getContainer(config)
  const runningFiles = new Set<string>(testFiles)

  channel.addEventListener('message', async (e: MessageEvent<IframeChannelEvent>): Promise<void> => {
    debug('channel event', JSON.stringify(e.data))
    switch (e.data.type) {
      case 'done': {
        const filenames = e.data.filenames
        filenames.forEach(filename => runningFiles.delete(filename))

        if (!runningFiles.size) {
          const ui = getUiAPI()
          // in isolated mode we don't change UI because it will slow down tests,
          // so we only select it when the run is done
          if (ui && filenames.length > 1) {
            const id = generateFileId(filenames[filenames.length - 1])
            ui.setCurrentById(id)
          }
          await done()
        }
        else {
          // keep the last iframe
          const iframeId = filenames.length > 1 ? ID_ALL : filenames[0]
          iframes.get(iframeId)?.remove()
          iframes.delete(iframeId)
        }
        break
      }
      // error happened at the top level, this should never happen in user code, but it can trigger during development
      case 'error': {
        const iframeId = e.data.files.length > 1 ? ID_ALL : e.data.files[0]
        iframes.delete(iframeId)
        await client.rpc.onUnhandledError(e.data.error, e.data.errorType)
        if (iframeId === ID_ALL)
          runningFiles.clear()
        else
          runningFiles.delete(iframeId)
        if (!runningFiles.size)
          await done()
        break
      }
      default: {
        await client.rpc.onUnhandledError({
          name: 'Unexpected Event',
          message: `Unexpected event: ${(e.data as any).type}`,
        }, 'Unexpected Event')
        await done()
      }
    }
  })

  if (config.browser.ui) {
    container.className = ''
    container.textContent = ''
  }

  if (config.isolate === false) {
    createIframe(
      container,
      ID_ALL,
    )
  }
  else {
    // otherwise, we need to wait for each iframe to finish before creating the next one
    // this is the most stable way to run tests in the browser
    for (const file of testFiles) {
      const ui = getUiAPI()

      if (ui) {
        const id = generateFileId(file)
        ui.setCurrentById(id)
      }

      createIframe(
        container,
        file,
      )
      await new Promise<void>((resolve) => {
        channel.addEventListener('message', function handler(e: MessageEvent<IframeChannelEvent>) {
          // done and error can only be triggered by the previous iframe
          if (e.data.type === 'done' || e.data.type === 'error') {
            channel.removeEventListener('message', handler)
            resolve()
          }
        })
      })
    }
  }
})

function generateFileId(file: string) {
  const config = getConfig()
  const project = config.name || ''
  const path = relative(config.root, file)
  return generateHash(`${path}${project}`)
}
