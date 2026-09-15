import { existsSync } from 'node:fs'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createVitest } from 'vitest/node'

await test('closing Vitest removes the root temp directory holding tmp module copies', async (t) => {
  // the root `Vitest._tmpDir` and the per-project `TestProject.tmpDir` are
  // bare nanoid dirs under `os.tmpdir()`: redirect it to a sandbox and assert
  // it is empty again after a successful run (issue #11224)
  const sandbox = await mkdtemp(join(tmpdir(), 'vitest-root-tmpdir-'))
  const envNames = ['TMPDIR', 'TEMP', 'TMP']
  const previous = envNames.map(name => process.env[name])
  for (const name of envNames) {
    process.env[name] = sandbox
  }
  t.after(async () => {
    envNames.forEach((name, i) => {
      if (previous[i] === undefined) {
        delete process.env[name]
      }
      else {
        process.env[name] = previous[i]
      }
    })
    await rm(sandbox, { recursive: true, force: true })
  })

  // `createVitest` + `start` instead of `startVitest`: the latter already
  // closes the instance when the run ends
  const vitest = await createVitest({
    root: './fixtures/root-tmpdir',
    // the forks pool is the one that reads tmp module copies from disk
    pool: 'forks',
    reporters: [{}],
  })
  t.after(() => vitest.close())

  await vitest.start()

  // sanity: the run wrote tmp module copies into the root temp dir, so the
  // leak this test covers really happened before `close()`
  t.assert.ok(vitest._tmpDir, 'root temp dir should be set during a run')
  t.assert.ok(existsSync(vitest._tmpDir), 'root temp dir should exist during a run')

  await vitest.close()

  t.assert.deepEqual(await readdir(sandbox), [])
})
