/**
 * @vitest-environment happy-dom
 */

import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import SFC from '../../../src/coverage-report/SFC.vue'

test('Should update count', async () => {
  const wrapper = mount(SFC)

  await wrapper.find('button').trigger('click')
  expect(wrapper.text()).contain(1)
})
