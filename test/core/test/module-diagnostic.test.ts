import type { File } from '@vitest/runner/types'
import type { TestModule } from 'vitest/node'
import { test } from 'vitest'
import { runInlineTests } from '../../test-utils'

// TODO: write comprehensive tests
test('123', async () => {
  const source = `
import {} from './hello-world'
import { test } from 'vitest'
// import 'side-effect'
// import * as m from 'module-import'
// import * as m2 from "module-import-2"
test('hello world')
    `
  const { fs, ctx } = await runInlineTests({
    'source.test.js': source,
    'hello-world': '',
  })
  const file = fs.resolveFile('./source.test.js')

  const environment = ctx!.vite.environments.ssr
  const testFile = ctx!.state.filesMap.get(file) as File[] | undefined
  const testModule = testFile?.length ? ctx!.state.getReportedEntity(testFile[0]) as TestModule : undefined
  // console.log(testModule)
  console.log(await ctx!.experimental_getModuleDiagnostic(environment, file, testModule))
})
