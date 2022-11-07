import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HelloWorld from '../components/HelloWorld.vue'

// For more complete examples on Vue, have a look in vitest/example/vue directory.

describe('components > HelloWorld', () => {
  it('Component should return prop with p tag', () => {
    const wrapper = mount(HelloWorld, {
      props: { message: 'Hello World' },
    })

    expect(wrapper.html()).toBe('<p>Hello World</p>')
  })
})
