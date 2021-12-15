const root = document.createElement('div')
const button = document.createElement('button')
button.id = 'btn'

let count = 0

button.textContent = `Clicked ${count} time(s)`

button.onclick = () => {
  count++
  button.textContent = `Clicked ${count} time(s)`
}

root.appendChild(button)
document.body.appendChild(root)
