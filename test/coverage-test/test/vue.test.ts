/**
 * @vitest-environment happy-dom
 */

import { expect, test } from 'vitest'
import { mount } from '@vue/test-utils'
import Hello from '../src/Hello.vue'
import Defined from '../src/Defined.vue'

test('vue 3 coverage', async() => {
  expect(Hello).toBeTruthy()

  const wrapper = mount(Hello, {
    props: {
      count: 4,
    },
  })

  expect(wrapper.text()).toContain('4 x 2 = 8')
  expect(wrapper.html()).toMatchSnapshot()

  await wrapper.get('button').trigger('click')

  expect(wrapper.text()).toContain('4 x 3 = 12')

  await wrapper.get('button').trigger('click')

  expect(wrapper.text()).toContain('4 x 4 = 16')
})

test('define package in vm', () => {
  expect(Defined).toBeTruthy()

  const wrapper = mount(Defined)

  expect(wrapper.text()).toContain(MY_CONSTANT)
})
