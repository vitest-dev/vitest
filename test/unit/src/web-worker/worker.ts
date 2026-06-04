self.onmessage = (e) => {
  self.postMessage(`${e.data} world`)

  const portPassedAsData = e.data?.port
  if (portPassedAsData) {
    portPassedAsData.postMessage(`Reply via port in data`)
  }

  const port = e.ports[0]
  if (port) {
    port.postMessage(`${e.data} world via port`)
  }
}
