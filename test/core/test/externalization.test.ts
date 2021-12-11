import { describe, it, expect } from 'vitest'
import { normalizeId, shouldExternalize, toFilePath } from '../../../src/node/execute'

describe('externalization', () => {
  it('normalize', () => {
    const root = '/project/root/'

    function normalize(id: string) {
      return toFilePath(normalizeId(id), root)
    }

    expect(normalize('')).toEqual('')
    expect(normalize('/@id/__hi__')).toEqual('__hi__')
    expect(normalize('/@fs/some/path')).toEqual('/some/path')
    expect(normalize('/@fs//some/path')).toEqual('/some/path')
    expect(normalize('/bare/path')).toEqual(`${root}bare/path`)
    expect(normalize('/@fs/D:\\some\\path')).toEqual('/D:/some/path')
    expect(normalize('/@fs//D:\\some\\path')).toEqual('/D:/some/path')
    expect(normalize('/@fs//D:/some/path')).toEqual('/D:/some/path')
  })

  it('externalize default', async() => {
    const root = '/project/root/'

    async function ext(id: string, _root = root) {
      const normalized = normalizeId(id)
      const filepath = toFilePath(normalized, _root)
      const result = await shouldExternalize(filepath, { inline: [], external: [] })
      return result
    }

    expect(await ext('')).toBeFalsy()
    expect(await ext(`${root}/src/hi.ts`)).toBeFalsy()
    expect(await ext('/@fs/hi/node_modules/any/index.js')).toBeTruthy()
    expect(await ext('/@fs/D:/a/vitest/vitest/node_modules/.pnpm/@jest+test-result@27.4.2/node_modules/@jest/test-result/build/index.js')).toBeTruthy()
    expect(await ext('/@fs/D:\\a\\node_modules\\.pnpm\\@jest+test-result@27.4.2\\node_modules\\@jest\\test-result\\build\\index.js')).toBeTruthy()

    // inline esm
    expect(await ext('/@fs/hi/node_modules/any/index.esm.js')).toBeFalsy()
    expect(await ext('/@fs/hi/node_modules/any/index.es6.js')).toBeFalsy()
    expect(await ext('/@fs/hi/node_modules/any/esm/index.js')).toBeFalsy()
    expect(await ext('/@fs/hi/node_modules/vue/index.js')).toBeFalsy()

    // external cjs
    expect(await ext('/@fs/hi/node_modules/vue/index.cjs.js')).toBeTruthy()
  })
})
