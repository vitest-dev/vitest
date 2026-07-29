import { expect, it } from 'vitest'
import { runVitest } from '../../test-utils'

it.each([
  ['test/default-css', {}],
  ['test/process-css', { include: [/App\.css/] }],
  [['test/process-module', 'test/process-inline'], { include: [/App\.module\.css/] }],
  ['test/scope-module', { include: [/App\.module\.css/], modules: { classNameStrategy: 'scoped' as const } }],
  ['test/non-scope-module', { include: [/App\.module\.css/], modules: { classNameStrategy: 'non-scoped' as const } }],
])('testing %s', async (name, config) => {
  const names = Array.isArray(name) ? name : [name]
  const { stderr } = await runVitest({
    config: false,
    root: './fixtures/css',
    css: config,
    update: true,
    environment: 'jsdom',
  }, names)

  expect(stderr).toBe('')
})
