import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '#test-utils'

test('a transform cached against a previous optimizer run is not reused', async () => {
  const { fs, testTree } = await runInlineTests(
    {
      'node_modules/fake-dep/package.json': JSON.stringify({
        name: 'fake-dep',
        type: 'module',
        main: 'index.js',
      }),
      'node_modules/fake-dep/index.js': `export const value = 'real'`,
      'node_modules/other-dep/package.json': JSON.stringify({
        name: 'other-dep',
        type: 'module',
        main: 'index.js',
      }),
      'node_modules/other-dep/index.js': `export const other = 1`,
      'src.js': `import { value } from 'fake-dep'; export const read = () => value`,
      'basic.test.js': /* js */ `
        import { expect, test, vi } from 'vitest'
        import { read } from './src.js'
        vi.mock('fake-dep', () => ({ value: 'mocked' }))
        test('mocked', () => {
          expect(read()).toBe('mocked')
        })
      `,
    },
    {
      fsModuleCache: true,
      fsModuleCachePath: './node_modules/.test-module-cache',
      deps: { optimizer: { ssr: { enabled: true, include: ['fake-dep'] } } },
    },
  )
  expect(testTree()).toMatchObject({ 'basic.test.js': { mocked: 'passed' } })

  // changes the optimizer's browserHash (`?v=`) without touching `src.js` or the config file
  const second = await runVitest({
    root: fs.root,
    fsModuleCache: true,
    fsModuleCachePath: './node_modules/.test-module-cache',
    deps: { optimizer: { ssr: { enabled: true, include: ['fake-dep', 'other-dep'] } } },
  })
  expect(second.testTree()).toMatchObject({ 'basic.test.js': { mocked: 'passed' } })
})

// https://github.com/vitest-dev/vitest/issues/11773
test('a transform cached by one project does not import the optimized deps of another', async () => {
  const project = (name: string) => ({
    extends: true,
    test: {
      name,
      include: [`${name}.test.js`],
      deps: { optimizer: { ssr: { enabled: true, include: ['fake-dep'] } } },
    },
  })
  const { fs, testTree } = await runInlineTests(
    {
      'node_modules/fake-dep/package.json': JSON.stringify({
        name: 'fake-dep',
        type: 'module',
        main: 'index.js',
      }),
      'node_modules/fake-dep/index.js': `export const instance = {}`,
      'shared.js': `export { instance } from 'fake-dep'`,
      'first.test.js': /* js */ `
        import { expect, test } from 'vitest'
        import { instance } from './shared.js'
        test('loads shared', () => {
          expect(instance).toBeTypeOf('object')
        })
      `,
      'second.test.js': /* js */ `
        import { expect, test } from 'vitest'
        import { instance } from 'fake-dep'
        import { instance as shared } from './shared.js'
        test('same instance', () => {
          expect(shared).toBe(instance)
        })
      `,
      'vitest.config.js': {
        test: {
          sharedViteServer: false,
          fsModuleCache: true,
          fsModuleCachePath: './node_modules/.test-module-cache',
          projects: [project('first'), project('second')],
        },
      },
    },
    { project: 'first' },
  )
  expect(testTree()).toMatchObject({ 'first.test.js': { 'loads shared': 'passed' } })

  const second = await runVitest({ root: fs.root, project: 'second' })
  expect(second.testTree()).toMatchObject({ 'second.test.js': { 'same instance': 'passed' } })
})
