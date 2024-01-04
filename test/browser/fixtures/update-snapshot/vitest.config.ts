import { defineConfig } from 'vitest/config'

/*
manually test watch mode via

1. run watch mode
  pnpm -C test/browser test-fixtures --root fixtures/update-snapshot

2. modify basic.test.ts
  from
    expect(1).toMatchSnapshot()
  to
    expect(2).toMatchSnapshot()

3. press "u" to update snapshot

*/

const provider = process.env.PROVIDER || 'webdriverio';
const browser = process.env.BROWSER || (provider === 'playwright' ? 'chromium' : 'chrome');

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      provider,
      name: browser,
    },
  },
})
