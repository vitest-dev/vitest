/**
 * @vitest-environment happy-dom
 */

import { expect, test, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Hello from '../src/Vue/Hello.vue'
import Defined from '../src/Vue/Defined.vue'
import { CounterVue } from '../src/Vue/Counter'

test('vue 3 coverage', async () => {
  expect(Hello).toBeTruthy()

  const wrapper = mount(Hello, {
    props: {
      count: 4,
    },
  })

  expect(wrapper.text()).toContain('4 x 2 = 8')
  expect(wrapper.html()).toMatchInlineSnapshot(`
    "<div>4 x 2 = 8</div>
    <button> x1 </button>"
  `)

  await wrapper.get('button').trigger('click')

  await vi.waitFor(() => {
    expect(wrapper.text()).toContain('4 x 3 = 12')
  })

  await wrapper.get('button').trigger('click')

  await vi.waitFor(() => {
    expect(wrapper.text()).toContain('4 x 4 = 16')
  })
})

test('define package in vm', () => {
  expect(Defined).toBeTruthy()

  const wrapper = mount(Defined)

  expect(wrapper.text()).toContain('hello')
})

test('vue non-SFC, uses query parameters in file imports', async () => {
  const wrapper = mount(CounterVue)

  await wrapper.find('button').trigger('click')
  expect(wrapper.text()).contain(1)
})
