import type { Context as OTELContext } from '@opentelemetry/api'
import type { GlobalChannelIncomingEvent, IframeChannelIncomingEvent, IframeChannelOutgoingEvent, IframeViewportDoneEvent, IframeViewportFailEvent } from '@vitest/browser/client'
import type { FileSpecification } from '@vitest/runner'
import type { BrowserTesterOptions, SerializedConfig } from 'vitest'
import { channel, client, globalChannel } from '@vitest/browser/client'
import { generateFileHash } from '@vitest/runner/utils'
import { relative } from 'pathe'
import { Traces } from 'vitest/internal/browser'
import { getUiAPI } from './ui'
import { getBrowserState, getConfig } from './utils'

const ID_ALL = '__vitest_all__'

export class IframeOrchestrator {
  private cancelled = false
  private recreateNonIsolatedIframe = false
  private iframes = new Map<string, HTMLIFrameElement>()

  public eventTarget: EventTarget = new EventTarget()

  private traces: Traces

  constructor() {
    debug('init orchestrator', getBrowserState().sessionId)

    const otelConfig = getBrowserState().config.experimental.openTelemetry
    this.traces = new Traces({
      enabled: !!(otelConfig?.enabled && otelConfig.browserSdkPath),
      sdkPath: otelConfig?.browserSdkPath,
    })

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
    await this.traces.waitInit()
    const orchestratorSpan = this.traces.startContextSpan(
      'vitest.browser.orchestrator.run',
      this.traces.getContextFromCarrier(options.otelCarrier),
    )
    orchestratorSpan.span.setAttributes({
      'vitest.browser.files': options.files.map(f => f.filepath),
    })
    const endSpan = async () => {
      orchestratorSpan.span.end()
      await this.traces.flush()
    }

    const startTime = performance.now()

    this.cancelled = false

    const config = getConfig()
    debug('create testers', ...options.files.join(', '))
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
      await this.runNonIsolatedTests(container, options, startTime, orchestratorSpan.context)
      await endSpan()
      return
    }

    this.iframes.forEach(iframe => iframe.remove())
    this.iframes.clear()

    for (let i = 0; i < options.files.length; i++) {
      if (this.cancelled) {
        await endSpan()
        return
      }

      const file = options.files[i]
      debug('create iframe', file.filepath)

      await this.runIsolatedTestInIframe(
        container,
        file,
        options,
        startTime,
        orchestratorSpan.context,
      )
      await endSpan()
    }
  }

  public async cleanupTesters(): Promise<void> {
    const config = getConfig()
    if (config.browser.isolate) {
      // isolated mode assigns filepaths as ids
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

  private async runNonIsolatedTests(
    container: HTMLDivElement,
    options: BrowserTesterOptions,
    startTime: number,
    otelContext: OTELContext,
  ) {
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
      await this.prepareIframe(container, ID_ALL, startTime, otelContext)
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
      otelCarrier: this.traces.getContextCarrier(otelContext),
    })
    debug('finished running tests', options.files.join(', '))
    // we don't cleanup here because in non-isolated mode
    // it is done after all tests finished running
  }

  private async runIsolatedTestInIframe(
    container: HTMLDivElement,
    spec: FileSpecification,
    options: BrowserTesterOptions,
    startTime: number,
    otelContext: OTELContext,
  ) {
    const config = getConfig()
    const { width, height } = config.browser.viewport

    const file = spec.filepath

    if (this.iframes.has(file)) {
      this.iframes.get(file)!.remove()
      this.iframes.delete(file)
    }

    const iframe = await this.prepareIframe(
      container,
      file,
      startTime,
      otelContext,
    )
    await setIframeViewport(iframe, width, height)
    // running tests after the "prepare" event
    await sendEventToIframe({
      event: 'execute',
      files: [spec],
      method: options.method,
      iframeId: file,
      context: options.providedContext,
      otelCarrier: this.traces.getContextCarrier(otelContext),
    })
    // perform "cleanup" to cleanup resources and calculate the coverage
    await sendEventToIframe({
      event: 'cleanup',
      iframeId: file,
      otelCarrier: this.traces.getContextCarrier(otelContext),
    })
  }

  private dispatchIframeError(error: Error) {
    const event = new CustomEvent('iframeerror', { detail: error })
    this.eventTarget.dispatchEvent(event)
    return error
  }

  private async prepareIframe(
    container: HTMLDivElement,
    iframeId: string,
    startTime: number,
    otelContext: OTELContext,
  ) {
    const iframe = this.createTestIframe(iframeId)
    container.appendChild(iframe)

    await new Promise<void>((resolve, reject) => {
      iframe.onload = () => {
        const href = this.getIframeHref(iframe)
        debug('iframe loaded with href', href)
        if (href !== iframe.src) {
          reject(this.dispatchIframeError(new Error(
            `Cannot connect to the iframe. `
            + `Did you change the location or submitted a form? `
            + 'If so, don\'t forget to call `event.preventDefault()` to avoid reloading the page.\n\n'
            + `Received URL: ${href || 'unknown'}\nExpected: ${iframe.src}`,
          )))
        }
        else {
          this.iframes.set(iframeId, iframe)
          sendEventToIframe({
            event: 'prepare',
            iframeId,
            startTime,
            otelCarrier: this.traces.getContextCarrier(otelContext),
          }).then(resolve, error => reject(this.dispatchIframeError(error)))
        }
      }
      iframe.onerror = (e) => {
        if (typeof e === 'string') {
          reject(this.dispatchIframeError(new Error(e)))
        }
        else if (e instanceof ErrorEvent) {
          reject(this.dispatchIframeError(e.error))
        }
        else {
          reject(this.dispatchIframeError(new Error(`Cannot load the iframe ${iframeId}.`)))
        }
      }
    })
    return iframe
  }

  private getIframeHref(iframe: HTMLIFrameElement) {
    try {
      // same origin iframe has contentWindow
      // same origin trusted iframe (where tests can run)
      // also allows accessing "location"
      return iframe.contentWindow?.location.href
    }
    catch {
      // looks like this iframe is not a tester.html
      return undefined
    }
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

const orchestrator = new IframeOrchestrator()
getBrowserState().orchestrator = orchestrator

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
  return new Promise<void>((resolve, reject) => {
    function cleanupEvents() {
      channel.removeEventListener('message', onReceived)
      orchestrator.eventTarget.removeEventListener('iframeerror', onError)
    }

    function onReceived(e: MessageEvent) {
      if (e.data.iframeId === event.iframeId && e.data.event === `response:${event.event}`) {
        resolve()
        cleanupEvents()
      }
    }

    function onError(e: Event) {
      reject((e as CustomEvent).detail)
      cleanupEvents()
    }

    orchestrator.eventTarget.addEventListener('iframeerror', onError)
    channel.addEventListener('message', onReceived)
  })
}

function generateFileId(file: string) {
  const config = getConfig()
  const path = relative(config.root, file)
  return generateFileHash(path, config.name)
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
