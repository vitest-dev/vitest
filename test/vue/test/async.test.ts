import { flushPromises, mount } from '@vue/test-utils'
import AsyncWrapper from '../components/AsyncWrapper.vue'

test('async component with suspense', async() => {
  expect(AsyncWrapper).toBeTruthy()

  const delay = 100
  const wrapper = mount(AsyncWrapper, {
    props: {
      delay,
    },
  })

  expect(wrapper.text()).toEqual('Fallback')

  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, delay))

  const text = wrapper.text()
  expect(Math.abs(+text - delay)).toBeLessThan(delay / 2)
})
