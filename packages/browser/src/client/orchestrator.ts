import type { SerializedConfig } from 'vitest'
import { channel, client } from '@vitest/browser/client'
import { globalChannel, type GlobalChannelIncomingEvent, type IframeChannelEvent, type IframeChannelIncomingEvent } from '@vitest/browser/client'
import { generateHash } from '@vitest/runner/utils'
import { relative } from 'pathe'
import { getUiAPI } from './ui'
import { getBrowserState, getConfig } from './utils'

const url = new URL(location.href)
const ID_ALL = '__vitest_all__'

class IframeOrchestrator {
  private cancelled = false
  private runningFiles = new Set<string>()
  private iframes = new Map<string, HTMLIFrameElement>()

  public async init() {
    const testFiles = getBrowserState().files

    debug('test files', testFiles.join(', '))

    this.runningFiles.clear()
    testFiles.forEach(file => this.runningFiles.add(file))

    channel.addEventListener(
      'message',
      e => this.onIframeEvent(e),
    )
    globalChannel.addEventListener(
      'message',
      e => this.onGlobalChannelEvent(e),
    )
  }

  public async createTesters(testFiles: string[]) {
    this.cancelled = false
    this.runningFiles.clear()
    testFiles.forEach(file => this.runningFiles.add(file))

    const config = getConfig()
    const container = await getContainer(config)

    if (config.browser.ui) {
      container.className = 'absolute origin-top mt-[8px]'
      container.parentElement!.setAttribute('data-ready', 'true')
      container.textContent = ''
    }
    const { width, height } = config.browser.viewport

    this.iframes.forEach(iframe => iframe.remove())
    this.iframes.clear()

    if (config.isolate === false) {
      const iframe = this.createIframe(container, ID_ALL)

      await setIframeViewport(iframe, width, height)
      return
    }

    for (const file of testFiles) {
      if (this.cancelled) {
        done()
        return
      }

      const iframe = this.createIframe(container, file)

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

  private createIframe(container: HTMLDivElement, file: string) {
    if (this.iframes.has(file)) {
      this.iframes.get(file)!.remove()
      this.iframes.delete(file)
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

    iframe.style.border = 'none'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('allow', 'clipboard-write;')
    iframe.setAttribute('name', 'vitest-iframe')

    this.iframes.set(file, iframe)
    container.appendChild(iframe)
    return iframe
  }

  private async onGlobalChannelEvent(e: MessageEvent<GlobalChannelIncomingEvent>) {
    debug('global channel event', JSON.stringify(e.data))
    switch (e.data.type) {
      case 'cancel': {
        this.cancelled = true
        break
      }
    }
  }

  private async onIframeEvent(e: MessageEvent<IframeChannelIncomingEvent>) {
    debug('iframe event', JSON.stringify(e.data))
    switch (e.data.type) {
      case 'viewport': {
        const { width, height, id } = e.data
        const iframe = this.iframes.get(id)
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
        filenames.forEach(filename => this.runningFiles.delete(filename))

        if (!this.runningFiles.size) {
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
          this.iframes.get(iframeId)?.remove()
          this.iframes.delete(iframeId)
        }
        break
      }
      // error happened at the top level, this should never happen in user code, but it can trigger during development
      case 'error': {
        const iframeId = e.data.id
        this.iframes.delete(iframeId)
        await client.rpc.onUnhandledError(e.data.error, e.data.errorType)
        if (iframeId === ID_ALL) {
          this.runningFiles.clear()
        }
        else {
          this.runningFiles.delete(iframeId)
        }
        if (!this.runningFiles.size) {
          await done()
        }
        break
      }
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
  }
}

const orchestrator = new IframeOrchestrator()

let promiseTesters: Promise<void> | undefined
getBrowserState().createTesters = async (files) => {
  await promiseTesters
  promiseTesters = orchestrator.createTesters(files).finally(() => {
    promiseTesters = undefined
  })
  await promiseTesters
}

async function done() {
  await client.rpc.finishBrowserTests(getBrowserState().contextId)
}

async function getContainer(config: SerializedConfig): Promise<HTMLDivElement> {
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

client.waitForConnection().then(async () => {
  const testFiles = getBrowserState().files

  await orchestrator.init()

  // if page was refreshed, there will be no test files
  // createTesters will be called again when tests are running in the UI
  if (testFiles.length) {
    await orchestrator.createTesters(testFiles)
  }
})

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
  else if (getBrowserState().provider === 'webdriverio') {
    iframe.style.width = `${width}px`
    iframe.style.height = `${height}px`
  }
  else {
    const scale = Math.min(
      1,
      iframe.parentElement!.parentElement!.clientWidth / width,
      iframe.parentElement!.parentElement!.clientHeight / height,
    )
    iframe.parentElement!.style.cssText = `
      width: ${width}px;
      height: ${height}px;
      transform: scale(${scale});
      transform-origin: left top;
    `
    iframe.parentElement?.setAttribute('data-scale', String(scale))
    await new Promise(r => requestAnimationFrame(r))
  }
}

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false') {
    client.rpc.debug(...args.map(String))
  }
}
