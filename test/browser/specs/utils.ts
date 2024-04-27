import { readFile } from 'node:fs/promises'
import type { UserConfig } from 'vitest'
import { runVitest } from '../../test-utils'

const browser = process.env.BROWSER || (process.env.PROVIDER !== 'playwright' ? 'chromium' : 'chrome')

export async function runBrowserTests(config?: Omit<UserConfig, 'browser'> & { browser?: Partial<UserConfig['browser']> }, include?: string[]) {
  const result = await runVitest({
    watch: false,
    reporters: 'none',
    ...config,
    browser: {
      headless: browser !== 'safari',
      ...config?.browser,
    } as UserConfig['browser'],
  }, include)

  const browserResult = await readFile('./browser.json', 'utf-8')
  const browserResultJson = JSON.parse(browserResult)

  const getPassed = results => results.filter(result => result.status === 'passed' && !result.mesage)
  const getFailed = results => results.filter(result => result.status === 'failed')

  const passedTests = getPassed(browserResultJson.testResults)
  const failedTests = getFailed(browserResultJson.testResults)

  return { ...result, browserResultJson, passedTests, failedTests }
}
