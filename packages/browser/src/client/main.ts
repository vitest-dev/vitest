import { channel, client } from './client'
import { rpcDone } from './rpc'
import { getBrowserState, getConfig } from './utils'

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

client.ws.addEventListener('open', async () => {
  const config = getConfig()
  const container = document.querySelector('#vitest-tester') as HTMLDivElement
  const testFiles = getBrowserState().files

  debug('test files', testFiles.join(', '))

  // TODO: fail tests suite because no tests found?
  if (!testFiles.length) {
    await done()
    return
  }

  const runningFiles = new Set<string>(testFiles)

  channel.addEventListener('message', async (e: MessageEvent<IframeChannelEvent>): Promise<void> => {
    debug('channel event', JSON.stringify(e.data))
    switch (e.data.type) {
      case 'done': {
        const filenames = e.data.filenames
        filenames.forEach(filename => runningFiles.delete(filename))

        if (!runningFiles.size)
          await done()
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

  if (config.isolate === false) {
    createIframe(
      container,
      ID_ALL,
    )
  }
  else {
    // TODO: if cofnig.fileParallelism, then at the same time, otherwise one after another
    for (const file of testFiles) {
      createIframe(
        container,
        file,
      )
    }
  }
})
