import { createApp, nextTick } from 'vue'
import AsyncWrapper from '../components/AsyncWrapper.vue'

test('async component with suspense', async () => {
  expect(AsyncWrapper).toBeTruthy()

  let resolve: Function

  const promise = new Promise(_resolve => resolve = _resolve)
  const wrapper = createApp(AsyncWrapper, {
    promise,
  })
  wrapper.mount(document.body)

  await nextTick()

  expect(wrapper._container).toBe(document.body)
  expect(wrapper._container?.innerHTML).toContain('fallback')

  resolve()

  await nextTick()
  await nextTick()

  expect(wrapper._container?.innerHTML).toContain('fallback')
})
