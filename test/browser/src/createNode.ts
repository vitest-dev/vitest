export function createNode() {
  const div = document.createElement('div')
  div.textContent = 'Hello World'
  document.body.appendChild(div)
  return div
}
