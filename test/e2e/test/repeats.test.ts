import type { TestModule } from 'vitest/node'
import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runInlineTests, runVitest } from '../../test-utils'

const root = resolve(__dirname, '..', 'fixtures', 'repeats')

test('repeats config option is exposed to tests and repeats execution', async () => {
  const { ctx } = await runVitest({
    root,
    include: ['repeats-config.test.ts'],
    repeats: 3,
  })

  const file = ctx!.state.getFiles()[0]
  const testModule = ctx!.state.getReportedEntity(file)! as TestModule
  const tests = [...testModule.children.allTests()]

  const fromConfig = tests.find(t => t.name === 'uses repeats from config')!
  expect(fromConfig.options.repeats).toBe(3)
  expect(fromConfig.diagnostic()!.repeatCount).toBe(3)

  const overridden = tests.find(t => t.name === 'test option overrides config')!
  expect(overridden.options.repeats).toBe(1)
  expect(overridden.diagnostic()!.repeatCount).toBe(1)
})

test('failed repeats are retained after a successful repeat', async () => {
  const { errorTree, results } = await runInlineTests({
    'repeats.test.js': `
      import { it } from 'vitest'

      it('fails twice then passes', { repeats: 2, retry: 1 }, ({ task }) => {
        if (task.result.repeatCount < 2) {
          throw new Error('repeat ' + task.result.repeatCount + ', retry ' + task.result.retryCount + ' failed')
        }
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "repeats.test.js": {
        "fails twice then passes": [
          "repeat 0, retry 0 failed",
          "repeat 0, retry 1 failed",
          "repeat 1, retry 1 failed",
          "repeat 1, retry 2 failed",
        ],
      },
    }
  `)
  const [test] = results[0].children.allTests()
  expect(test.diagnostic()!.retryCount).toBe(2)
  expect(test.diagnostic()!.repeatCount).toBe(2)
})

test('onTestFailed runs only for failed repeats', async () => {
  const { errorTree } = await runInlineTests({
    'repeats.test.js': `
      import { expect, it } from 'vitest'

      const failedRepeats = []

      it('alternates passing and failing repeats', { repeats: 4 }, ({ task, onTestFailed }) => {
        const repeatCount = task.result.repeatCount
        onTestFailed(() => failedRepeats.push(repeatCount))
        if (repeatCount % 2 === 1) {
          throw new Error('repeat ' + repeatCount + ' failed')
        }
      })

      it('records failed repeats', () => {
        expect(failedRepeats).toEqual([1, 3])
      })
    `,
  })

  expect(errorTree()).toMatchInlineSnapshot(`
    {
      "repeats.test.js": {
        "alternates passing and failing repeats": [
          "repeat 1 failed",
          "repeat 3 failed",
        ],
        "records failed repeats": "passed",
      },
    }
  `)
})
