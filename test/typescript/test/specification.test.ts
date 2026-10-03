import { expect, test } from 'vitest'
import { runInlineTests } from '../../test-utils'

test('typecheck tasks create specifications for the typescript pool', async () => {
  const { ctx } = await runInlineTests(
    {
      'basic.check.ts': /* ts */ `
        import { describe, expectTypeOf, test } from 'vitest'
        describe('suite', () => {
          test('number is a number', () => {
            expectTypeOf(1).toBeNumber()
          })
        })
      `,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          strict: true,
          noEmit: true,
          target: 'esnext',
          module: 'esnext',
          moduleResolution: 'bundler',
          skipLibCheck: true,
        },
        include: ['*.check.ts'],
      }),
    },
    { typecheck: { enabled: true, only: true, include: ['*.check.ts'] } },
  )

  const [testModule] = ctx!.state.getTestModules()
  const [testSuite] = testModule.children.suites()
  const [testCase] = testSuite.children.tests()

  const moduleSpecification = testModule.toTestSpecification()
  expect(moduleSpecification.pool).toBe('typescript')
  expect(moduleSpecification.testModule).toBe(testModule)

  const suiteSpecification = testSuite.toTestSpecification()
  expect(suiteSpecification.pool).toBe('typescript')
  expect(suiteSpecification.testModule).toBe(testModule)

  const caseSpecification = testCase.toTestSpecification()
  expect(caseSpecification.pool).toBe('typescript')
  expect(caseSpecification.testModule).toBe(testModule)
})
