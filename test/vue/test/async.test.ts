import { flushPromises, mount } from '@vue/test-utils'
import AsyncWrapper from '../components/AsyncWrapper.vue'

test('async component with suspense', async() => {
  expect(AsyncWrapper).toBeTruthy()

  const delay = 50
  const wrapper = mount(AsyncWrapper, {
    props: {
      delay,
    },
  })

  expect(wrapper.text()).toContain('fallback')

  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, delay * 3))

  const text = wrapper.text()
  expect(text).toMatch(/\d+/)
  expect(text).toContain('resolved')
})
