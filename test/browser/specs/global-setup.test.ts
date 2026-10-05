import { expect, test } from 'vitest'
import { ts } from '../../test-utils'
import { instances, runInlineBrowserTests } from './utils'

const globalSetup = ts`
  import { appendFileSync } from 'node:fs'
  import { resolve } from 'pathe'

  export default function setup(project) {
    const file = resolve(project.config.root, 'setup-runs.txt')
    appendFileSync(file, 'setup:' + project.name + '\n')
    project.provide('setupProject', project.name)
    return () => appendFileSync(file, 'teardown:' + project.name + '\n')
  }
`

test.for([1, 2])('runs root global setup once with %i browser instances', async (count) => {
  const { ctx, stderr, fs, results } = await runInlineBrowserTests(
    {
      'global-setup.js': globalSetup,
      'basic.test.js': ts`
        import { expect, inject, test } from 'vitest'
        test('receives root context', () => {
          expect(inject('setupProject')).toBe('root')
        })
      `,
    },
    {
      name: 'root',
      globalSetup: './global-setup.js',
      browser: {
        instances: Array.from({ length: count }, (_, index) => ({
          ...instances[0],
          name: `instance-${index}`,
        })),
      },
    },
  )

  expect(stderr).toBe('')
  expect(results).toHaveLength(count)
  expect(ctx!.state.getCountOfFailedTests()).toBe(0)
  await ctx!.close()
  expect(fs.readFile('setup-runs.txt')).toBe('setup:root\nteardown:root\n')
})

test('runs global setup explicitly configured on a browser instance', async () => {
  const { ctx, stderr, fs, testTree } = await runInlineBrowserTests(
    {
      'global-setup.js': globalSetup,
      'basic.test.js': ts`
        import { expect, inject, test } from 'vitest'
        test('receives instance context', () => {
          expect(inject('setupProject')).toBe('instance')
        })
      `,
    },
    {
      name: 'root',
      globalSetup: './global-setup.js',
      browser: {
        instances: [{ ...instances[0], name: 'instance', globalSetup: './global-setup.js' }],
      },
    },
  )

  expect(stderr).toBe('')
  expect(testTree()).toMatchInlineSnapshot(`
    {
      "basic.test.js": {
        "receives instance context": "passed",
      },
    }
  `)
  await ctx!.close()
  expect(fs.readFile('setup-runs.txt').trim().split('\n').sort()).toEqual([
    'setup:instance',
    'setup:root',
    'teardown:instance',
    'teardown:root',
  ])
})
