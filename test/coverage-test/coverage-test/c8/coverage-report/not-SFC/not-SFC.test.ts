/**
 * @vitest-environment happy-dom
 */

import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import notSFC from '../../../../src/coverage-report/not-SFC/not-SFC.vue'

test('Should update count', async () => {
  const wrapper = mount(notSFC)

  await wrapper.find('button').trigger('click')
  expect(wrapper.text()).contain(1)
})
