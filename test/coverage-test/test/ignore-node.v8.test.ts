import { expect } from 'vitest'
import { isNativeRunner, readCoverageMap, runVitest, test } from '../utils'

/* See {@link file://./../fixtures/src/ignore-node.ts} */
const filename = '<process-cwd>/fixtures/src/ignore-node.ts'

test('{ ignoreNode } excludes the matching nodes', async () => {
  await runVitest({
    include: ['fixtures/test/ignore-node-fixture.test.ts'],
    coverage: {
      reporter: 'json',
      ignoreNode: (node, type) => {
        if (
          type === 'statement' &&
          node.type === 'ExpressionStatement' &&
          node.expression.type === 'CallExpression' &&
          node.expression.callee.type === 'Identifier' &&
          node.expression.callee.name === '__generatedHelper'
        ) {
          return true
        }

        return type === 'branch' && node.type === 'IfStatement'
      },
    },
  })

  const coverageMap = await readCoverageMap()
  const fileCoverage = coverageMap.fileCoverageFor(filename)
  const lines = fileCoverage.getLineCoverage()

  expect(lines[4]).toBeUndefined()

  expect(fileCoverage.getBranchCoverageByLine()[6]).toBeUndefined()

  expect(lines[7]).toBeGreaterThanOrEqual(1)
  expect(lines[8]).toBeGreaterThanOrEqual(1)

  expect(lines[11]).toBe(0)
})

test('{ ignoreNode } is not called for nodes that Vitest already ignores', async ({ skip }) => {
  skip(isNativeRunner(), 'Native runner does not transform imports to __vite_ssr_import_')

  const declarators: string[] = []

  await runVitest({
    include: ['fixtures/test/ignore-node-fixture.test.ts'],
    coverage: {
      reporter: 'json',
      ignoreNode: (node) => {
        if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
          declarators.push(node.id.name)
        }
      },
    },
  })

  expect(declarators).toEqual(['total'])
})
