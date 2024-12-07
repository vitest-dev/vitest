import { stripVTControlCharacters } from 'node:util'
import IstanbulProvider from '@vitest/coverage-istanbul'
import V8Provider from '@vitest/coverage-v8'
import packageJson from '@vitest/coverage-v8/package.json'
import { expect, test, vi } from 'vitest'
import { configDefaults } from 'vitest/config'

const version = packageJson.version

test('v8 provider logs warning if versions do not match', async () => {
  const provider = await V8Provider.getProvider()
  const warn = vi.fn()

  provider.initialize({
    version: '1.0.0',
    logger: { warn },
    config: configDefaults,
  } as any)

  expect(warn).toHaveBeenCalled()

  const message = warn.mock.calls[0][0]

  expect(stripVTControlCharacters(message)).toMatchInlineSnapshot(`
    "Loaded  vitest@1.0.0  and  @vitest/coverage-v8@${version} .
    Running mixed versions is not supported and may lead into bugs
    Update your dependencies and make sure the versions match."
  `)
})

test('istanbul provider logs warning if versions do not match', async () => {
  const provider = await IstanbulProvider.getProvider()
  const warn = vi.fn()

  provider.initialize({
    version: '1.0.0',
    logger: { warn },
    config: configDefaults,
  } as any)

  expect(warn).toHaveBeenCalled()

  const message = warn.mock.calls[0][0]

  expect(stripVTControlCharacters(message)).toMatchInlineSnapshot(`
    "Loaded  vitest@1.0.0  and  @vitest/coverage-istanbul@${version} .
    Running mixed versions is not supported and may lead into bugs
    Update your dependencies and make sure the versions match."
  `)
})
