import type { BrowserInstanceOption } from 'vitest/node'
import { expect } from 'vitest'

interface SummaryOptions {
  passed?: number
}

expect.extend({
  toReportPassedTest(stdout: string, testName: string, testProject?: string | BrowserInstanceOption[]) {
    const checks: BrowserInstanceOption[] | undefined = Array.isArray(testProject)
      ? testProject
      : (testProject && [{ browser: testProject }])

    const pass = checks?.length
      ? checks.every(({ browser }) => {
          const includePattern = `✓ |${browser}| ${testName}`
          return stdout.includes(includePattern)
        })
      : stdout.includes(`✓ ${testName}`)

    return {
      pass,
      message: () => {
        const includePattern = checks?.length
          ? checks.map(check => `✓ |${check.browser}| ${testName}`).join('\n')
          : `✓ ${testName}`
        return `expected ${pass ? 'not ' : ''}to have "${includePattern}" in the report.\n\nstdout:\n${stdout}`
      },
    }
  },
  toReportSummaryTestFiles(stdout: string, { passed }: SummaryOptions) {
    const includePattern = `Test Files  ${passed} passed`
    const pass = !passed || stdout.includes(includePattern)
    return {
      pass,
      message: () => `expected ${pass ? 'not ' : ''}to have "${includePattern}" in the report.\n\nstdout:\n${stdout}`,
    }
  },
  toReportSummaryTests(stdout: string, { passed }: SummaryOptions) {
    const includePattern = `Tests  ${passed} passed`
    const pass = !passed || stdout.includes(includePattern)
    return {
      pass,
      message: () => `expected ${pass ? 'not ' : ''}to have "${includePattern}" in the report.\n\nstdout:\n${stdout}`,
    }
  },
  toReportNoErrors(stderr: string) {
    const pass = !stderr
    return {
      pass,
      message: () => `expected ${pass ? 'not ' : ''}to have no errors.\n\nstderr:\n${stderr}`,
    }
  },
})

declare module 'vitest' {
  // eslint-disable-next-line unused-imports/no-unused-vars
  interface Assertion<T = any> {
    // eslint-disable-next-line ts/method-signature-style
    toReportPassedTest(testName: string, testProject?: string | BrowserInstanceOption[]): void
    // eslint-disable-next-line ts/method-signature-style
    toReportSummaryTestFiles(options: SummaryOptions): void
    // eslint-disable-next-line ts/method-signature-style
    toReportSummaryTests(options: SummaryOptions): void
    // eslint-disable-next-line ts/method-signature-style
    toReportNoErrors(): void
  }
}

export {}
