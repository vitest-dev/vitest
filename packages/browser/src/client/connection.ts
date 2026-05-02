export interface WebSocketConnectionOptions {
  url: string
  WebSocketCtor?: typeof WebSocket
  autoReconnect?: boolean
  reconnectInterval?: number
  reconnectTries?: number
  connectTimeout?: number
}

export interface WebSocketConnection {
  readonly socket: WebSocket
  send: (data: string) => void
  waitForConnection: () => Promise<void>
  onMessage: (handler: (data: unknown) => void) => void
}

export function createWebSocketConnection(options: WebSocketConnectionOptions): WebSocketConnection {
  const {
    url,
    WebSocketCtor = WebSocket,
    autoReconnect = true,
    reconnectInterval = 2000,
    reconnectTries = 10,
    connectTimeout = 60000,
  } = options

  let triesLeft = reconnectTries
  let socket = new WebSocketCtor(url)
  let messageHandler: ((data: unknown) => void) | undefined

  let resolveOpen!: () => void
  let rejectOpen!: (error: Error) => void
  let openSettled = false
  let openPromise: Promise<void> = createOpenPromise()
  let connectTimeoutId: ReturnType<typeof setTimeout> | undefined
  let attemptAbort: AbortController | undefined

  function createOpenPromise() {
    openSettled = false
    return new Promise<void>((resolve, reject) => {
      resolveOpen = () => {
        openSettled = true
        resolve()
      }
      rejectOpen = (error) => {
        openSettled = true
        reject(error)
      }
    })
  }

  function clearConnectTimeout() {
    if (connectTimeoutId !== undefined) {
      clearTimeout(connectTimeoutId)
      connectTimeoutId = undefined
    }
  }

  function reconnect(reset = false) {
    if (reset) {
      triesLeft = reconnectTries
    }
    if (openSettled) {
      openPromise = createOpenPromise()
    }
    socket = new WebSocketCtor(url)
    registerSocket()
  }

  function registerSocket() {
    attemptAbort?.abort()
    const controller = new AbortController()
    attemptAbort = controller
    const { signal } = controller

    clearConnectTimeout()
    connectTimeoutId = setTimeout(() => {
      if (signal.aborted) {
        return
      }
      rejectOpen(
        new Error(
          `Cannot connect to the server in ${connectTimeout / 1000} seconds`,
        ),
      )
    }, connectTimeout)

    function onOpen() {
      triesLeft = reconnectTries
      clearConnectTimeout()
      resolveOpen()
    }

    if (socket.readyState === socket.OPEN) {
      onOpen()
    }
    socket.addEventListener('open', onOpen, { signal })
    socket.addEventListener('message', (event) => {
      messageHandler?.((event as MessageEvent).data)
    }, { signal })
    socket.addEventListener('close', () => {
      triesLeft -= 1
      clearConnectTimeout()
      if (autoReconnect && triesLeft > 0) {
        setTimeout(reconnect, reconnectInterval)
      }
      else if (!openSettled) {
        rejectOpen(new Error('WebSocket connection closed before opening'))
      }
    }, { signal })
  }

  registerSocket()

  return {
    get socket() {
      return socket
    },
    send: data => socket.send(data),
    waitForConnection: () => openPromise,
    onMessage: (handler) => {
      messageHandler = handler
    },
  }
}
