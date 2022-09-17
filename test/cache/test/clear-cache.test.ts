import fs, { promises as fsp } from 'fs'
import { resolve } from 'pathe'
import { describe, expect, test } from 'vitest'
import { VitestCache } from '../../../packages/vitest/src/node/cache/index'

const root = resolve(__dirname, '..')

const pathBase = resolve(root, 'cache/.vitest-base')
const pathCustom = resolve(root, 'cache/.vitest-custom')

describe('vitest cache', async () => {
  await fsp.mkdir(pathBase, { recursive: true })
  await fsp.mkdir(pathCustom, { recursive: true })

  test('clears cache without specifying config path', async () => {
    await VitestCache.clearCache({})

    expect(fs.existsSync(pathBase)).toBe(false)
  })

  test('clears cache with specified config path', async () => {
    await VitestCache.clearCache({ config: 'vitest-custom.config.ts' })

    expect(fs.existsSync(pathCustom)).toBe(false)
  })
})
