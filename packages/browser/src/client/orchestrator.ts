import type { ResolvedConfig } from 'vitest'
import { generateHash } from '@vitest/runner/utils'
import { relative } from 'pathe'
import { channel, client } from './client'
import { rpcDone } from './rpc'
import { getBrowserState, getConfig } from './utils'
import { getUiAPI } from './ui'
import type { IframeChannelEvent, IframeChannelIncomingEvent } from './channel'
import { createModuleMocker } from './msw'

const url = new URL(location.href)

const ID_ALL = '__vitest_all__'

const iframes = new Map<string, HTMLIFrameElement>()

let promiseTesters: Promise<void> | undefined
getBrowserState().createTesters = async (files) => {
  await promiseTesters
  promiseTesters = createTesters(files).finally(() => {
    promiseTesters = undefined
  })
  await promiseTesters
}

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false') {
    client.rpc.debug(...args.map(String))
  }
}

function createIframe(container: HTMLDivElement, file: string) {
  if (iframes.has(file)) {
    iframes.get(file)!.remove()
    iframes.delete(file)
  }

  const iframe = document.createElement('iframe')
  iframe.setAttribute('loading', 'eager')
  iframe.setAttribute(
    'src',
    `${url.pathname}__vitest_test__/__test__/${
      getBrowserState().contextId
    }/${encodeURIComponent(file)}`,
  )
  iframe.setAttribute('data-vitest', 'true')

  iframe.style.display = 'block'
  iframe.style.border = 'none'
  iframe.style.zIndex = '1'
  iframe.style.position = 'relative'
  iframe.setAttribute('allowfullscreen', 'true')
  iframe.setAttribute('allow', 'clipboard-write;')

  iframes.set(file, iframe)
  container.appendChild(iframe)
  return iframe
}

async function done() {
  await rpcDone()
  await client.rpc.finishBrowserTests(getBrowserState().contextId)
}

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

const runningFiles = new Set<string>()

client.ws.addEventListener('open', async () => {
  const testFiles = getBrowserState().files

  debug('test files', testFiles.join(', '))

  runningFiles.clear()
  testFiles.forEach(file => runningFiles.add(file))

  const mocker = createModuleMocker()

  channel.addEventListener(
    'message',
    async (e: MessageEvent<IframeChannelIncomingEvent>): Promise<void> => {
      debug('channel event', JSON.stringify(e.data))
      switch (e.data.type) {
        case 'viewport': {
          const { width, height, id } = e.data
          const iframe = iframes.get(id)
          if (!iframe) {
            const error = new Error(`Cannot find iframe with id ${id}`)
            channel.postMessage({
              type: 'viewport:fail',
              id,
              error: error.message,
            })
            await client.rpc.onUnhandledError(
              {
                name: 'Teardown Error',
                message: error.message,
              },
              'Teardown Error',
            )
            return
          }
          await setIframeViewport(iframe, width, height)
          channel.postMessage({ type: 'viewport:done', id })
          break
        }
        case 'done': {
          const filenames = e.data.filenames
          filenames.forEach(filename => runningFiles.delete(filename))

          if (!runningFiles.size) {
            const ui = getUiAPI()
            // in isolated mode we don't change UI because it will slow down tests,
            // so we only select it when the run is done
            if (ui && filenames.length > 1) {
              const id = generateFileId(filenames[filenames.length - 1])
              ui.setCurrentFileId(id)
            }
            await done()
          }
          else {
            // keep the last iframe
            const iframeId = e.data.id
            iframes.get(iframeId)?.remove()
            iframes.delete(iframeId)
          }
          break
        }
        // error happened at the top level, this should never happen in user code, but it can trigger during development
        case 'error': {
          const iframeId = e.data.id
          iframes.delete(iframeId)
          await client.rpc.onUnhandledError(e.data.error, e.data.errorType)
          if (iframeId === ID_ALL) {
            runningFiles.clear()
          }
          else {
            runningFiles.delete(iframeId)
          }
          if (!runningFiles.size) {
            await done()
          }
          break
        }
        case 'mock:invalidate':
          mocker.invalidate()
          break
        case 'unmock':
          await mocker.unmock(e.data)
          break
        case 'mock':
          await mocker.mock(e.data)
          break
        case 'mock-factory:error':
        case 'mock-factory:response':
          // handled manually
          break
        default: {
          e.data satisfies never

          await client.rpc.onUnhandledError(
            {
              name: 'Unexpected Event',
              message: `Unexpected event: ${(e.data as any).type}`,
            },
            'Unexpected Event',
          )
          await done()
        }
      }
    },
  )

  // if page was refreshed, there will be no test files
  // createTesters will be called again when tests are running in the UI
  if (testFiles.length) {
    await createTesters(testFiles)
  }
})

async function createTesters(testFiles: string[]) {
  runningFiles.clear()
  testFiles.forEach(file => runningFiles.add(file))

  const config = getConfig()
  const container = await getContainer(config)

  if (config.browser.ui) {
    container.className = 'scrolls'
    container.textContent = ''
  }
  const { width, height } = config.browser.viewport

  iframes.forEach(iframe => iframe.remove())
  iframes.clear()

  if (config.isolate === false) {
    const iframe = createIframe(container, ID_ALL)

    await setIframeViewport(iframe, width, height)
  }
  else {
    // otherwise, we need to wait for each iframe to finish before creating the next one
    // this is the most stable way to run tests in the browser
    for (const file of testFiles) {
      const iframe = createIframe(container, file)

      await setIframeViewport(iframe, width, height)

      await new Promise<void>((resolve) => {
        channel.addEventListener(
          'message',
          function handler(e: MessageEvent<IframeChannelEvent>) {
            // done and error can only be triggered by the previous iframe
            if (e.data.type === 'done' || e.data.type === 'error') {
              channel.removeEventListener('message', handler)
              resolve()
            }
          },
        )
      })
    }
  }
}

function generateFileId(file: string) {
  const config = getConfig()
  const project = config.name || ''
  const path = relative(config.root, file)
  return generateHash(`${path}${project}`)
}

async function setIframeViewport(
  iframe: HTMLIFrameElement,
  width: number,
  height: number,
) {
  const ui = getUiAPI()
  if (ui) {
    await ui.setIframeViewport(width, height)
  }
  else {
    iframe.style.width = `${width}px`
    iframe.style.height = `${height}px`
  }
}
