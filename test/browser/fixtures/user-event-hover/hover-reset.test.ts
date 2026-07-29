import { beforeEach, expect, test } from 'vitest'
import { page, server, userEvent } from 'vitest/browser'

beforeEach(async () => {
  document.body.innerHTML = `
<style>
.btn {
  background-color: blue;
  &:hover {
    background-color: red;
  }
}
</style>
`
  await userEvent.unhover(document.body)
})

function render() {
  const container = document.createElement('div')
  container.innerHTML = `
<div class="btn" role="button" style="width: 100px; height: 50px;">
  hello
</div>
`
  document.body.appendChild(container)
}

test('click', async () => {
  render()
  await page.getByRole('button').click()
  await expect.element(page.getByRole('button')).toHaveStyle('background-color: red')
})

test('after click', async () => {
  render()
  expect(page.getByRole('button').element()).toHaveStyle('background-color: blue')
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 200))
  expect(page.getByRole('button').element()).toHaveStyle('background-color: blue')
})
