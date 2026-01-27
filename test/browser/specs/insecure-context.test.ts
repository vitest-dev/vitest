import os from 'node:os'
import { expect, test } from 'vitest'
import { instances, runBrowserTests } from './utils'

// server.host = os.hostname // doesnt work on mac, therefore the test is only run on linux
test.runIf(os.platform() === 'linux')('server-host check dynamic import at insecure context', async () => {
  const { stdout, stderr } = await runBrowserTests({
    root: './fixtures/insecure-context',
  })

  expect(stderr).toBe('')
  expect(stdout).toReportSummaryTestFiles({ passed: instances.length })
})
