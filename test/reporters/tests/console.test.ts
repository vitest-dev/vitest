import { resolve } from 'pathe'
import { expect, test } from 'vitest'
import { runVitest } from '../../test-utils'

test('should print logs correctly', async () => {
  const filename = resolve('./fixtures/console.test.ts')
  const { stdout, stderr } = await runVitest({ root: './fixtures' }, [filename])

  expect(stdout).toBeTruthy()
  expect(stderr).toBeTruthy()

  expect(stdout).toContain(
`stdout | console.test.ts > suite > nested suite
nested suite stdin beforeAll
nested suite stdin afterAll

stdout | console.test.ts > suite
suite stdin beforeAll
suite stdin afterAll

stdout | console.test.ts
global stdin beforeAll
global stdin afterAll
`,
  )

  expect(stderr).toContain(
`stderr | console.test.ts > suite > nested suite
nested suite stderr beforeAll
nested suite stderr afterAll

stderr | console.test.ts > suite
suite stderr beforeAll
suite stderr afterAll

stderr | console.test.ts
global stderr beforeAll
global stderr afterAll`,
  )
})
