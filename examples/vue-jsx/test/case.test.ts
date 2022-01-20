import { shallowMount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import Case from '../src/Case'

test('mount component', () => {
  const wrapper = shallowMount(Case, {
    props: {
      value: 'test',
    },
    global: {
      stubs: ['a-select', 'a-select-option'],
    },
  })

  expect(wrapper.html()).toMatchSnapshot()
})
