import process from 'node:process'
import { expect, it } from 'vitest'

// @ts-expect-error untyped
import * as notFound from '../src/external/not-found.js'

const [major, minor] = process.version.slice(1).split('.').map(v => Number(v))

it.runIf(major >= 20 && minor >= 6)('internal (node >= v20.6)', async () => {
  await expect(() => notFound.importInternal()).rejects.toMatchObject({
    message: expect.stringMatching(/ENOENT: no such file or directory, open '.*?non-existing-path'/),
  })
})

it.runIf(major >= 20 && minor < 6)('internal (node < v20.6)', async () => {
  await expect(() => notFound.importInternal()).rejects.toMatchObject({
    message: expect.stringMatching(/Cannot find module '.*?non-existing-path'/),
  })
})

it('external', async () => {
  await expect(() => notFound.importExternal()).rejects.toMatchObject({
    message: expect.stringContaining('Cannot find package \'@vitest/non-existing-package\''),
  })
})

/*
//
// before
//

volta pin node@20.5.0
pnpm -C test/vm-threads test not-found.test.ts

 FAIL  test/not-found.test.ts > internal
Error: Cannot find module '/home/hiroshi/code/others/vitest/test/vm-threads/src/external/not-found-internal' imported from /home/hiroshi/code/others/vitest/test/vm-threads/src/external/not-found-internal.js
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  test/not-found.test.ts > external
Error: Cannot find package '@vitest/not-found-external' imported from /home/hiroshi/code/others/vitest/test/vm-threads/src/external/not-found-external.js
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }

//
// after
//

volta pin node@20.11.0
pnpm -C test/vm-threads test repro.test.ts

 FAIL  test/repro.test.ts > repro
Error: ENOENT: no such file or directory, open '../src/external/not-found'
 ❯ readFileSync node:fs:453:20
 ❯ async /home/hiroshi/code/others/vitest/test/vm-threads/test/repro.test.ts:4:15

volta pin node@20.5.0
pnpm -C test/vm-threads test repro.test.ts

 FAIL  test/repro.test.js [ test/repro.test.js ]
Error: Cannot find package '@vitest/test-not-found' imported from /home/hiroshi/code/others/vitest/test/vm-threads/src/external/import-not-found.js
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯
Serialized Error: { code: 'ERR_MODULE_NOT_FOUND' }

node -e 'await import("test/vm-threads/src/external/not-found.js")'

*/
