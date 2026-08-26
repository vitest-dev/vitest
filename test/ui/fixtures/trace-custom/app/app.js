const button = document.querySelector('button')
const input = document.querySelector('input')
const output = document.querySelector('output')

button.addEventListener('click', () => {
  button.textContent = 'After action'
})

input.addEventListener('input', () => {
  output.textContent = `Attempt ${input.value}`
})
