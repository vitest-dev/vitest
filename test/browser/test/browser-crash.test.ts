import { it } from 'vitest'

it.skip('fails gracefully when browser crashes', async () => {
  const parentDiv = document.createElement('div')
  let currentDiv = parentDiv

  // Simulate crash by adding a large number of nodes
  for (let i = 0; i < 20000; i++) {
    const newDiv = document.createElement('div')
    currentDiv.appendChild(newDiv)
    currentDiv = newDiv
  }

  document.body.appendChild(parentDiv)
})
