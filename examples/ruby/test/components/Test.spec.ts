import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import Test from '../../components/Test.component.vue'

describe('CoachInboxItem', () => {
  it('renders', () => {
    const wrapper = mount(Test)

    expect(wrapper.html()).toContain('hello world')
  })
})
