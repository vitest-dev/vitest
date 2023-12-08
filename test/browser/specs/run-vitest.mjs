import { readFile } from 'node:fs/promises'
import { execa } from 'execa'

const browser = process.env.BROWSER || (process.env.PROVIDER === 'playwright' ? 'chromium' : 'chrome')

export default async function runVitest(moreArgs = []) {
  const argv = ['vitest', '--run', `--browser.name=${browser}`]

  if (browser !== 'safari')
    argv.push('--browser.headless')

  const { stderr, stdout } = await execa('npx', argv.concat(moreArgs), {
    env: {
      ...process.env,
      CI: 'true',
      NO_COLOR: 'true',
    },
    reject: false,
  })
  const browserResult = await readFile('./browser.json', 'utf-8')
  const browserResultJson = JSON.parse(browserResult)

  const getPassed = results => results.filter(result => result.status === 'passed')
  const getFailed = results => results.filter(result => result.status === 'failed')

  const passedTests = getPassed(browserResultJson.testResults)
  const failedTests = getFailed(browserResultJson.testResults)

  return { stderr, stdout, browserResultJson, passedTests, failedTests }
}
