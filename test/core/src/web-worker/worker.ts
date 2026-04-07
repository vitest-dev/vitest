self.onmessage = (e) => {
  self.postMessage(`${e.data} world`)

  const port = e.ports[0]
  if (port) {
    port.postMessage(`${e.data} world via port`)
  }
}
