import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { execa } from 'execa'

const browser = process.env.BROWSER || (process.env.PROVIDER === 'playwright' ? 'chromium' : 'chrome')

await execa('npx', ['vitest', '--run', '--shard=1/2', `--browser.name=${browser}`, '--browser.headless', '--outputFile=browser-shard.json'], {
  env: {
    ...process.env,
    CI: 'true',
    NO_COLOR: 'true',
  },
  reject: false,
})

const browserResult = await readFile('./browser-shard.json', 'utf-8')
const browserResultJson = JSON.parse(browserResult)

await test('shard option runs portion of tests', async () => {
  assert.strictEqual(browserResultJson.numTotalTests, 12)
})
