import type { GlobalChannelIncomingEvent, IframeChannelIncomingEvent, IframeChannelOutgoingEvent, IframeViewportDoneEvent, IframeViewportFailEvent } from '@vitest/browser/client'
import type { BrowserTesterOptions, SerializedConfig } from 'vitest'
import { channel, client, globalChannel } from '@vitest/browser/client'
import { generateHash } from '@vitest/runner/utils'
import { relative } from 'pathe'
import { getUiAPI } from './ui'
import { getBrowserState, getConfig } from './utils'

const ID_ALL = '__vitest_all__'

export class IframeOrchestrator {
  private cancelled = false
  private recreateNonIsolatedIframe = false
  private iframes = new Map<string, HTMLIFrameElement>()

  constructor() {
    debug('init orchestrator', getBrowserState().sessionId)

    channel.addEventListener(
      'message',
      e => this.onIframeEvent(e),
    )
    globalChannel.addEventListener(
      'message',
      e => this.onGlobalChannelEvent(e),
    )
  }

  public async createTesters(options: BrowserTesterOptions): Promise<void> {
    this.cancelled = false

    const config = getConfig()
    debug('create testers', options.files.join(', '))
    const container = await getContainer(config)

    if (config.browser.ui) {
      container.className = 'absolute origin-top mt-[8px]'
      container.parentElement!.setAttribute('data-ready', 'true')
      // in non-isolated mode this will also remove the iframe,
      // so we only do this once
      if (container.textContent) {
        container.textContent = ''
      }
    }

    if (config.browser.isolate === false) {
      await this.runNonIsolatedTests(container, options)
      return
    }

    this.iframes.forEach(iframe => iframe.remove())
    this.iframes.clear()

    for (let i = 0; i < options.files.length; i++) {
      if (this.cancelled) {
        return
      }

      const file = options.files[i]
      debug('create iframe', file)

      await this.runIsolatedTestInIframe(
        container,
        file,
        options,
      )
    }
  }

  public async cleanupTesters(): Promise<void> {
    const config = getConfig()
    if (config.browser.isolate) {
      // isolated mode assignes filepaths as ids
      const files = Array.from(this.iframes.keys())
      // when the run is completed, show the last file in the UI
      const ui = getUiAPI()
      if (ui && files[0]) {
        const id = generateFileId(files[0])
        ui.setCurrentFileId(id)
      }
      return
    }
    // we only cleanup non-isolated iframe because
    // in isolated mode every iframe is cleaned up after the test
    const iframe = this.iframes.get(ID_ALL)
    if (!iframe) {
      return
    }
    await sendEventToIframe({
      event: 'cleanup',
      iframeId: ID_ALL,
    })
    this.recreateNonIsolatedIframe = true
  }

  private async runNonIsolatedTests(container: HTMLDivElement, options: BrowserTesterOptions) {
    if (this.recreateNonIsolatedIframe) {
      // recreate a new non-isolated iframe during watcher reruns
      // because we called "cleanup" in the previous run
      // the iframe is not removed immediately to let the user see the last test
      this.recreateNonIsolatedIframe = false
      this.iframes.get(ID_ALL)!.remove()
      this.iframes.delete(ID_ALL)
      debug('recreate non-isolated iframe')
    }

    if (!this.iframes.has(ID_ALL)) {
      debug('preparing non-isolated iframe')
      await this.prepareIframe(container, ID_ALL, options.startTime)
    }

    const config = getConfig()
    const { width, height } = config.browser.viewport
    const iframe = this.iframes.get(ID_ALL)!

    await setIframeViewport(iframe, width, height)
    debug('run non-isolated tests', options.files.join(', '))
    await sendEventToIframe({
      event: 'execute',
      iframeId: ID_ALL,
      files: options.files,
      method: options.method,
      context: options.providedContext,
    })
    // we don't cleanup here because in non-isolated mode
    // it is done after all tests finished running
  }

  private async runIsolatedTestInIframe(
    container: HTMLDivElement,
    file: string,
    options: BrowserTesterOptions,
  ) {
    const config = getConfig()
    const { width, height } = config.browser.viewport

    if (this.iframes.has(file)) {
      this.iframes.get(file)!.remove()
      this.iframes.delete(file)
    }

    const iframe = await this.prepareIframe(container, file, options.startTime)
    await setIframeViewport(iframe, width, height)
    // running tests after the "prepare" event
    await sendEventToIframe({
      event: 'execute',
      files: [file],
      method: options.method,
      iframeId: file,
      context: options.providedContext,
    })
    // perform "cleanup" to cleanup resources and calculate the coverage
    await sendEventToIframe({
      event: 'cleanup',
      iframeId: file,
    })
  }

  private async prepareIframe(container: HTMLDivElement, iframeId: string, startTime: number) {
    const iframe = this.createTestIframe(iframeId)
    container.appendChild(iframe)

    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => {
        this.iframes.set(iframeId, iframe)
        sendEventToIframe({
          event: 'prepare',
          iframeId,
          startTime,
        }).then(resolve, reject)
      }
      iframe.onerror = (e) => {
        if (typeof e === 'string') {
          reject(new Error(e))
        }
        else if (e instanceof ErrorEvent) {
          reject(e.error)
        }
        else {
          reject(new Error(`Cannot load the iframe ${iframeId}.`))
        }
      }
    })
    return iframe
  }

  private createTestIframe(iframeId: string) {
    const iframe = document.createElement('iframe')
    const src = `/?sessionId=${getBrowserState().sessionId}&iframeId=${iframeId}`
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
    switch (e.data.event) {
      case 'viewport': {
        const { width, height, iframeId: id } = e.data
        const iframe = this.iframes.get(id)
        if (!iframe) {
          const error = `Cannot find iframe with id ${id}`
          channel.postMessage({
            event: 'viewport:fail',
            iframeId: id,
            error,
          } satisfies IframeViewportFailEvent)
          await client.rpc.onUnhandledError(
            {
              name: 'Teardown Error',
              message: error,
            },
            'Teardown Error',
          )
          break
        }
        await setIframeViewport(iframe, width, height)
        channel.postMessage({ event: 'viewport:done', iframeId: id } satisfies IframeViewportDoneEvent)
        break
      }
      default: {
        // ignore responses
        if (
          typeof e.data.event === 'string'
          && (e.data.event as string).startsWith('response:')
        ) {
          break
        }

        await client.rpc.onUnhandledError(
          {
            name: 'Unexpected Event',
            message: `Unexpected event: ${(e.data as any).event}`,
          },
          'Unexpected Event',
        )
      }
    }
  }
}

getBrowserState().orchestrator = new IframeOrchestrator()

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

async function sendEventToIframe(event: IframeChannelOutgoingEvent) {
  channel.postMessage(event)
  return new Promise<void>((resolve) => {
    channel.addEventListener(
      'message',
      function handler(e) {
        if (e.data.iframeId === event.iframeId && e.data.event === `response:${event.event}`) {
          resolve()
          channel.removeEventListener('message', handler)
        }
      },
    )
  })
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
  else if (getBrowserState().provider === 'webdriverio') {
    iframe.parentElement?.setAttribute('data-scale', '1')
    await client.rpc.triggerCommand(
      getBrowserState().sessionId,
      '__vitest_viewport',
      undefined,
      [{ width, height }],
    )
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
