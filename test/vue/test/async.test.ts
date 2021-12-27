import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import AsyncWrapper from '../components/AsyncWrapper.vue'

test('async component with suspense', async() => {
  expect(AsyncWrapper).toBeTruthy()

  let resolve: Function
  // eslint-disable-next-line promise/param-names
  const promise = new Promise(_resolve => resolve = _resolve)
  const wrapper = mount(AsyncWrapper, {
    props: {
      promise,
    },
  })

  expect(wrapper.text()).toContain('fallback')

  resolve()

  await flushPromises()
  await nextTick()

  const text = wrapper.text()
  expect(text).toContain('resolved')
})
