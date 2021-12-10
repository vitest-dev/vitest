import Hello from '../components/Hello.svelte'

test('mount component', async() => {
  const host = document.createElement('div')
  host.setAttribute('id', 'host')
  document.body.appendChild(host)
  const instance = new Hello({ target: host, props: { count: 4 } })
  expect(instance).toBeTruthy()
  expect(host.innerHTML).toContain('4 x 2 = 8')
})
