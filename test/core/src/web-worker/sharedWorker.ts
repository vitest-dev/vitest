self.addEventListener('connect', (event) => {
  const e = event as MessageEvent
  const port = e.ports[0]

  port.onmessage = (e) => {
    port.postMessage(e.data)
  }

  port.start()
})
