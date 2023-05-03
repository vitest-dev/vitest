import { createApp } from 'vue'
import AsAsync from '../components/AsAsync.vue'

test('mount component', async () => {
  expect(AsAsync).toBeTruthy()

  const wrapper = createApp(AsAsync)
  wrapper.mount(document.body)

  const button = document.querySelector('button')
  expect(button).toBeDefined()
  button?.click()

  await new Promise(resolve => setTimeout(resolve, 200))

  expect(wrapper._container.innerHTML).toContain('1 x 2 = 2')
})
