import Hello from '../components/Hello.svelte'

async function sleep(n: number) {
  return new Promise(resolve => setTimeout(resolve, n))
}

test('mount component', async() => {
  const host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
  const instance = new Hello({ target: host, props: { count: 4 } })
  expect(instance).toBeTruthy()
  expect(host.innerHTML).toContain('4 x 2 = 8')
  expect(host.innerHTML).toMatchSnapshot()
  const btn = host.getElementsByTagName('button')[0]
  btn.click() // or btn.dispatchEvent(new window.Event('click', { bubbles: true }))
  await sleep(50) // required, wait for dom to update
  expect(host.innerHTML).toContain('4 x 3 = 12')
  btn.click()
  await sleep(50)
  expect(host.innerHTML).toContain('4 x 4 = 16')
})

/*
//TODO improvements
    - generic way to create svelte components from import ( helper utility or library )
    - await changes without sleep
    - generic api for interacting with components
    - alternatives to expect with innerHTML
 */
