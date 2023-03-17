import assert from 'node:assert'
import { readFile } from 'node:fs/promises'
import { execa } from 'execa'

const browser = process.env.BROWSER || 'chrome'

let error
await execa('npx', ['vitest', `--browser=${browser}`], {
  env: {
    ...process.env,
    CI: 'true',
    NO_COLOR: 'true',
  },
  stdout: 'inherit',
  stderr: 'inherit'
})
  .catch((e) => {
    error = e
  })

if (error) {
  console.error(error)
  process.exit(1)
}

const browserResult = await readFile('./browser.json', 'utf-8')
const browserResultJson = JSON.parse(browserResult)

assert.ok(browserResultJson.testResults.length === 3, 'Not all the tests have been run')

for (let result of browserResultJson.testResults) {
  assert.ok(result.status === 'passed')
}
