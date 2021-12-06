import { createApp } from 'vue'
import Hello from '../components/Hello.vue'

function mount(Comp: any, props: any) {
  const root = window.document.createElement('div')
  const app = createApp(Comp, props)
  const instance = app.mount(root)
  return {
    root,
    app,
    instance,
  }
}

test('mount component', async() => {
  expect(Hello).toBeTruthy()

  const { root } = mount(Hello, { count: 4 })

  expect(root.innerHTML).toContain('<div>4 x 2 = 8</div>')
})
