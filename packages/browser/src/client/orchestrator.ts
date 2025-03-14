import type { GlobalChannelIncomingEvent, IframeChannelEvent, IframeChannelIncomingEvent } from '@vitest/browser/client'
import type { BrowserTesterOptions, SerializedConfig } from 'vitest'
import type { IframeInitEvent } from './types'
import { channel, client, globalChannel } from '@vitest/browser/client'
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

  public init() {
    debug('init orchestrator', getBrowserState().sessionId)

    this.runningFiles.clear()

    channel.addEventListener(
      'message',
      e => this.onIframeEvent(e),
    )
    globalChannel.addEventListener(
      'message',
      e => this.onGlobalChannelEvent(e),
    )
  }

  public async createTesters(options: BrowserTesterOptions) {
    this.cancelled = false
    this.runningFiles.clear()
    options.files.forEach(file => this.runningFiles.add(file))

    const config = getConfig()
    debug('create testers', options.files.join(', '))
    const container = await getContainer(config)

    if (config.browser.ui) {
      container.className = 'absolute origin-top mt-[8px]'
      container.parentElement!.setAttribute('data-ready', 'true')
      container.textContent = ''
    }

    this.iframes.forEach(iframe => iframe.remove())
    this.iframes.clear()

    const isolate = config.browser.isolate

    for (const file of options.files) {
      if (this.cancelled) {
        return
      }

      debug('create iframe', file)

      await this.runTestInIframe(
        container,
        isolate === false ? ID_ALL : file,
        file,
        options,
      )
    }
  }

  private async runTestInIframe(
    container: HTMLDivElement,
    id: string,
    file: string,
    options: BrowserTesterOptions,
  ) {
    const config = getConfig()
    const { width, height } = config.browser.viewport

    const iframe = config.browser.isolate === false
      ? this.startInIsolatedIframe(container, file, options)
      : this.startInNewIframe(container, id, file, options)

    await setIframeViewport(iframe, width, height)
    await this.waitForIframeDoneEvent()
  }

  private startIframeTest(
    iframe: HTMLIFrameElement,
    iframeId: string,
    file: string,
    options: BrowserTesterOptions,
  ) {
    const iframeWindow = iframe.contentWindow
    if (!iframeWindow) {
      debug('no window available')
      // TODO: what happened here?
      return
    }

    iframeWindow.postMessage(
      JSON.stringify({
        event: 'init',
        method: options.method,
        files: [file],
        iframeId,
        context: options.providedContext,
      } satisfies IframeInitEvent),
      '*',
    )
  }

  private createTestIframe() {
    const iframe = document.createElement('iframe')
    const src = `${url.pathname}__vitest_test__/__test__/?sessionId=${getBrowserState().sessionId}`
    iframe.setAttribute('loading', 'eager')
    iframe.setAttribute('src', src)
    iframe.setAttribute('data-vitest', 'true')

    iframe.style.border = 'none'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.setAttribute('allowfullscreen', 'true')
    iframe.setAttribute('allow', 'clipboard-write;')
    iframe.setAttribute('name', 'vitest-iframe')
    return iframe
  }

  // TODO: a lot of tests on how this actually works
  private startInIsolatedIframe(
    container: HTMLDivElement,
    file: string,
    options: BrowserTesterOptions,
  ) {
    const cachedIframe = this.iframes.get(ID_ALL)
    if (cachedIframe) {
      this.startIframeTest(cachedIframe, ID_ALL, file, options)
      return cachedIframe
    }
    return this.startInNewIframe(container, ID_ALL, file, options)
  }

  private startInNewIframe(
    container: HTMLDivElement,
    iframeId: string,
    file: string,
    options: BrowserTesterOptions,
  ) {
    if (this.iframes.has(iframeId)) {
      this.iframes.get(iframeId)!.remove()
      this.iframes.delete(iframeId)
    }

    const iframe = this.createTestIframe()
    iframe.onerror = (e) => {
      debug('iframe error', e.toString())
    }
    iframe.onload = () => {
      debug(`iframe for ${file} loaded`)
      this.startIframeTest(iframe, iframeId, file, options)
    }

    this.iframes.set(iframeId, iframe)
    container.appendChild(iframe)
    return iframe
  }

  private waitForIframeDoneEvent() {
    return new Promise<void>((resolve) => {
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
      }
    }
  }
}

const orchestrator = new IframeOrchestrator()

let promiseTesters: Promise<void> | undefined
getBrowserState().createTesters = async (options: BrowserTesterOptions) => {
  await promiseTesters
  promiseTesters = orchestrator.createTesters(options).finally(() => {
    promiseTesters = undefined
  })
  await promiseTesters
}

async function getContainer(config: SerializedConfig): Promise<HTMLDivElement> {
  if (config.browser.ui) {
    const element = document.querySelector('#tester-ui')
    if (!element) {
      return new Promise<HTMLDivElement>((resolve) => {
        queueMicrotask(() => {
          resolve(getContainer(config))
        })
      })
    }
    return element as HTMLDivElement
  }
  return document.querySelector('#vitest-tester') as HTMLDivElement
}

client.waitForConnection().then(async () => {
  orchestrator.init()
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
  else {
    iframe.style.width = `${width}px`
    iframe.style.height = `${height}px`
  }
}

function debug(...args: unknown[]) {
  const debug = getConfig().env.VITEST_BROWSER_DEBUG
  if (debug && debug !== 'false') {
    client.rpc.debug(...args.map(String))
  }
}
