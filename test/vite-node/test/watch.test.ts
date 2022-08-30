import fs from 'fs-extra'
import { resolve } from 'pathe'
import { beforeAll, beforeEach, describe, expect, test } from 'vitest'
import type { ExecaContext } from './utils'
import { readNextData, setupTestFixture } from './utils'

const TIMEOUT = 60_000

const srcDir = resolve(__dirname, '../src/watch')
const fixtureDir = resolve(__dirname, '../.watch-fixture')
const entryPath = resolve(fixtureDir, 'index.ts')
const dependentPath = resolve(fixtureDir, 'a.ts')

describe('watch', () => {
  describe('valid start', () => {
    beforeEach(setupTestFixture(srcDir, fixtureDir, ['-w', entryPath]))

    test<ExecaContext>('reruns on entry file change', async ({ stdout }) => {
      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Running"')
      }

      await fs.writeFile(entryPath, 'console.log(\'updated\')')

      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"updated"')
      }
    }, TIMEOUT)

    test<ExecaContext>('reruns on dependent file change', async ({ stdout, stdin }) => {
      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Running"')
      }

      {
        stdin.write('\n')
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Received result from a() \\"a\\""')
      }

      await fs.writeFile(dependentPath, 'export const a = () => \'A changed\'')

      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Running"')
      }

      {
        stdin.write('\n')
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Received result from a() \\"A changed\\""')
      }
    }, TIMEOUT)

    test<ExecaContext>('will continue running on failed update and recover on fix', async ({ stdout, stdin, stderr }) => {
      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Running"')
      }

      // Failed update
      await fs.writeFile(dependentPath, 'export const a = ')

      {
        const result = await readNextData(stderr)
        expect(result).toMatchInlineSnapshot(`
          "Transform failed with 1 error:
          <rootDir>/test/vite-node/.watch-fixture/a.ts:1:17: ERROR: Unexpected end of file"
        `)
      }

      // Is the original code still running?
      {
        stdin.write('\n')
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Received result from a() \\"a\\""')
      }

      // // Recover failed update with a working change
      await fs.writeFile(dependentPath, 'export const a = () => \'A changed\'')

      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Running"')
      }

      {
        stdin.write('\n')
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Received result from a() \\"A changed\\""')
      }
    }, TIMEOUT)
  })

  describe('invalid start', () => {
    const invalidSrcDir = resolve(__dirname, '../.invalid-start-fixture')

    beforeAll(async () => {
      await fs.copy(srcDir, invalidSrcDir, {
        overwrite: true,
      })

      await fs.writeFile(resolve(invalidSrcDir, 'a.ts'), 'export const a = () =>')

      return async () => {
        await fs.remove(invalidSrcDir)
      }
    })

    beforeEach(setupTestFixture(invalidSrcDir, fixtureDir, ['-w', entryPath]))

    test<ExecaContext>('fails but recovers on entry file change', async ({ stdout, stderr }) => {
      {
        const result = await readNextData(stderr)
        expect(result).toMatchInlineSnapshot(`
          "Transform failed with 1 error:
          <rootDir>/test/vite-node/.watch-fixture/a.ts:1:22: ERROR: Unexpected end of file"
        `)
      }

      await fs.writeFile(entryPath, 'console.log(\'updated\')')

      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"updated"')
      }
    }, TIMEOUT)

    test<ExecaContext>('fails but recovers on on dependent file change', async ({ stdout, stdin, stderr }) => {
      {
        const result = await readNextData(stderr)
        expect(result).toMatchInlineSnapshot(`
          "Transform failed with 1 error:
          <rootDir>/test/vite-node/.watch-fixture/a.ts:1:22: ERROR: Unexpected end of file"
        `)
      }

      await fs.writeFile(dependentPath, 'export const a = () => \'a\'')

      {
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Running"')
      }

      {
        stdin.write('\n')
        const result = await readNextData(stdout)
        expect(result).toMatchInlineSnapshot('"Received result from a() \\"a\\""')
      }
    }, TIMEOUT)
  })
})
