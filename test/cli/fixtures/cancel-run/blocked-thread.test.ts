import { execSync } from 'node:child_process'
import { test } from 'vitest'

test('block whole test runner thread/process', { timeout: 30_000 }, async () => {
  // Note that this can also block the RPC before onTestCaseReady is emitted to main thread
  execSync("sleep 40")
})
