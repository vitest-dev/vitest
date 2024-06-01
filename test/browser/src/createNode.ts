export function createNode() {
  const div = document.createElement('div')
  div.className = 'node'
  div.textContent = 'Hello World!'
  return div
}
