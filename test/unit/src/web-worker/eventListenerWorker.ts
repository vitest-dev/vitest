function callback(e: MessageEvent) {
  self.postMessage(`${e.data} world`)
  self.removeEventListener('message', callback)
}

self.addEventListener('message', callback)
