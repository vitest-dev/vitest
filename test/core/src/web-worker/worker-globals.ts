self.onmessage = () => {
  self.postMessage({
    crypto: !!self.crypto,
    caches: !!self.caches,
    location: !!self.location,
    origin: self.origin,
  })
}
