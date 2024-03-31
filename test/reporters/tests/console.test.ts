import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('should print logs correctly', async () => {
  const filename = resolve('./fixtures/console.test.ts')
  const { stdout, stderr } = await runVitest({ root: './fixtures' }, [filename])

  expect(stdout).toBeTruthy()
  expect(stderr).toBeTruthy()

  expect(stdout.replace('\n ✓ console.test.ts > suite > snested suite > test', '')).toContain(
`
stdout | console.test.ts > suite > nested suite
beforeAll
afterAll

stdout | console.test.ts > suite
beforeAll
afterAll

stdout | console.test.ts
beforeAll
afterAll
`,
  )

  expect(stderr).toContain(
`stderr | console.test.ts > suite > nested suite
beforeAll
afterAll

stderr | console.test.ts > suite
beforeAll
afterAll

stderr | console.test.ts
beforeAll
afterAll`,
  )
})
