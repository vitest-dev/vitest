self.addEventListener('message', (e) => {
  self.postMessage(`${e.data} world`)
})
