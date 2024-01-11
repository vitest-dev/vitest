import Hello from '../components/Hello.marko'

let host: HTMLElement

afterEach(() => {
  host.remove()
})

test('mount component', async () => {
  host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
  const instance = Hello
    .renderSync({ count: 4 })
    .appendTo(host)
    .getComponent()
  expect(instance).toBeTruthy()
  expect(host.innerHTML).toContain('4 x 2 = 8')
  expect(host.innerHTML).toMatchSnapshot()
  const btn = host.getElementsByTagName('button')[0]
  btn.click() // or btn.dispatchEvent(new window.Event('click', { bubbles: true }))
  await tick()
  expect(host.innerHTML).toContain('4 x 3 = 12')
  btn.click()
  await tick()
  expect(host.innerHTML).toContain('4 x 4 = 16')
})

async function tick() {
  await new Promise(resolve => setTimeout(resolve))
}
