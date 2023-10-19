import { createApp, nextTick } from 'vue'
import Hello from '../components/Hello.vue'

test('mount component', async () => {
  expect(Hello).toBeTruthy()

  const wrapper = createApp(Hello, {
    count: 4,
  })
  wrapper.mount(document.body)

  expect(wrapper._container).toBe(document.body)
  expect(wrapper._container?.innerHTML).toContain('4 x 2 = 8')
  expect(wrapper._container?.innerHTML).toMatchSnapshot()

  const button = document.querySelector('button')
  expect(button).toBeDefined()
  expect(document.activeElement).toBe(document.body)
  button?.focus()
  await nextTick()
  expect(document.activeElement).toBe(button)
  button?.click()
  await nextTick()

  expect(wrapper._container?.innerHTML).toContain('4 x 3 = 12')

  button?.click()
  await nextTick()

  expect(wrapper._container?.innerHTML).toContain('4 x 4 = 16')
})
