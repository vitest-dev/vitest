import { flushPromises, mount } from '@vue/test-utils'
import AsAsync from '../components/AsAsync.vue'

test('mount component', async () => {
  expect(AsAsync).toBeTruthy()

  const wrapper = mount(AsAsync, { attachTo: document.body })

  await wrapper.find('button').trigger('click')

  await flushPromises() // start loading, so vitest started loading
  await vi.dynamicImportSettled()

  wrapper.vm.$nextTick().then(() => {
    expect(wrapper.html()).toContain('1 x 2 = 2')
  })
  // expect(wrapper.html()).toContain('1 x 2 = 2')
})
