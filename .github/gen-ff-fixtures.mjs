// node .github/gen-ff-fixtures.mjs <count>
// writes test/browser/fixtures/ff-mouse and test/browser/fixtures/ff-plain
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs'

const count = Number(process.argv[2] || 40)
const root = new URL('../test/browser/fixtures/', import.meta.url)

const style = `
<style>
.btn {
  background-color: blue;
  &:hover {
    background-color: red;
  }
}
</style>
`

const render = `
function render() {
  const container = document.createElement('div')
  container.innerHTML = '<div class="btn" role="button" style="width: 100px; height: 50px;">hello</div>'
  document.body.appendChild(container)
}
`

const mouse = `import { beforeEach, expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'

beforeEach(async () => {
  document.body.innerHTML = \`${style}\`
  await userEvent.unhover(document.body)
})
${render}
test('click', async () => {
  render()
  await page.getByRole('button').click()
  await expect.element(page.getByRole('button')).toHaveStyle('background-color: red')
})

test('after click', async () => {
  render()
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 50))
  expect(page.getByRole('button').element()).toHaveStyle('background-color: blue')
})
`

const plain = `import { beforeEach, expect, test } from 'vitest'
import { page } from 'vitest/browser'

beforeEach(async () => {
  document.body.innerHTML = \`${style}\`
})
${render}
test('render', async () => {
  render()
  await expect.element(page.getByRole('button')).toHaveStyle('background-color: blue')
})

test('after render', async () => {
  render()
  await new Promise(r => requestAnimationFrame(r))
  await new Promise(r => setTimeout(r, 50))
  expect(page.getByRole('button').element()).toHaveStyle('background-color: blue')
})
`

for (const [name, content] of [['ff-mouse', mouse], ['ff-plain', plain]]) {
  const dir = new URL(`${name}/`, root)
  mkdirSync(dir, { recursive: true })
  copyFileSync(new URL('user-event-hover/vitest.config.ts', root), new URL('vitest.config.ts', dir))
  for (let i = 0; i < count; i++) {
    writeFileSync(new URL(`file-${String(i).padStart(2, '0')}.test.ts`, dir), content)
  }
}
