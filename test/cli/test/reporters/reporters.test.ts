import type { RunnerTestCase, RunnerTestFile, RunnerTestSuite } from 'vitest'
import type { TestModule } from 'vitest/node'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import { createFileTask } from '@vitest/runner/utils'
import { normalize, resolve } from 'pathe'
import { beforeEach, expect, test, vi } from 'vitest'
import { JsonReporter, JUnitReporter, TapFlatReporter, TapReporter } from 'vitest/node'
import { files, getContext, passedFiles } from './utils'

const beautify = (json: string) => JSON.parse(json)
function getTestModules(_files = files) {
  return _files.map(task => ({ task }) as TestModule)
}

beforeEach(() => {
  vi.setSystemTime(1642587001759)
  return () => {
    vi.useRealTimers()
  }
})

test('tap reporter', async () => {
  // Arrange
  const reporter = new TapReporter()
  const context = getContext()
  const testModules = getTestModules()

  // Act
  reporter.onInit(context.vitest)
  reporter.onTestRunEnd(testModules)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('tap-flat reporter', async () => {
  // Arrange
  const reporter = new TapFlatReporter()
  const context = getContext()
  const testModules = getTestModules()

  // Act
  reporter.onInit(context.vitest)
  reporter.onTestRunEnd(testModules)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter', async () => {
  // Arrange
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const context = getContext()

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onTestRunEnd([])

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter without classname', async () => {
  // Arrange
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const context = getContext()
  const testModules = getTestModules(passedFiles)

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter with custom string classname', async () => {
  // Arrange
  const reporter = new JUnitReporter({ classnameTemplate: 'my-custom-classname', hostname: 'hostname' })
  const context = getContext()
  const testModules = getTestModules(passedFiles)

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter with custom function classnameTemplate', async () => {
  // Arrange
  const reporter = new JUnitReporter({
    classnameTemplate: task => `filename:${task.filename} - filepath:${task.filepath}`,
    hostname: 'hostname',
  })
  const context = getContext()
  const testModules = getTestModules(passedFiles)

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(context.output).toMatchSnapshot()
})
test('JUnit reporter with custom string classnameTemplate', async () => {
  // Arrange
  const reporter = new JUnitReporter({
    classnameTemplate: `filename:{filename} - filepath:{filepath}`,
    hostname: 'hostname',
  })
  const context = getContext()
  const testModules = getTestModules(passedFiles)

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter (no outputFile entry)', async () => {
  // Arrange
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const context = getContext()
  context.vitest.config.outputFile = {}

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onTestRunEnd([])

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter with outputFile', async () => {
  // Arrange
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const outputFile = resolve('report.xml')
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onTestRunEnd([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile object', async () => {
  // Arrange
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const outputFile = resolve('report_object.xml')
  const context = getContext()
  context.vitest.config.outputFile = {
    junit: outputFile,
  }

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onTestRunEnd([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile in non-existing directory', async () => {
  // Arrange
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const rootDirectory = resolve('junitReportDirectory')
  const outputFile = `${rootDirectory}/deeply/nested/report.xml`
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onTestRunEnd([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile object in non-existing directory', async () => {
  // Arrange
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const rootDirectory = resolve('junitReportDirectory_object')
  const outputFile = `${rootDirectory}/deeply/nested/report.xml`
  const context = getContext()
  context.vitest.config.outputFile = {
    junit: outputFile,
  }

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onTestRunEnd([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter emits [[ATTACHMENT]] for failure screenshots', async () => {
  const reporter = new JUnitReporter({ hostname: 'hostname' })
  const context = getContext()

  const file: RunnerTestFile = createFileTask('/vitest/test/shot.test.ts', '/vitest/test', '')
  file.mode = 'run'
  file.result = { state: 'fail', duration: 10 }

  const suite: RunnerTestSuite = {
    id: `${file.id}_0`,
    type: 'suite',
    name: 'screenshots',
    fullName: `${file.fullName} > screenshots`,
    fullTestName: `${file.fullTestName} > screenshots`,
    mode: 'run',
    meta: {},
    file,
    result: { state: 'fail', duration: 10 },
    tasks: [],
  }

  const failedTest: RunnerTestCase = {
    id: `${suite.id}_0`,
    type: 'test',
    name: 'failing test',
    fullName: `${suite.fullName} > failing test`,
    fullTestName: `${suite.fullTestName} > failing test`,
    mode: 'run',
    fails: undefined,
    meta: {},
    file,
    suite,
    annotations: [],
    artifacts: [
      {
        type: 'internal:failureScreenshot',
        attachments: [
          {
            name: 'screenshot',
            path: '/screenshots/shot.png',
            originalPath: '/screenshots/shot.png',
          } as any,
        ],
      },
    ],
    // result has state=fail but no errors array, so capturePrintError is not called
    result: {
      state: 'fail',
      errors: [],
      duration: 5,
    },
    timeout: 0,
    context: null as any,
  }

  suite.tasks = [failedTest]
  file.tasks = [suite]

  await reporter.onInit(context.vitest)
  await reporter.onTestRunEnd([{ task: file } as TestModule])

  expect(context.output).toContain('[[ATTACHMENT|/screenshots/shot.png]]')
})

test('json reporter', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const context = getContext()
  const testModules = getTestModules()

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(JSON.parse(context.output)).toMatchSnapshot()
})

test('json reporter (no outputFile entry)', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const context = getContext()
  context.vitest.config.outputFile = {}
  const testModules = getTestModules()

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(JSON.parse(context.output)).toMatchSnapshot()
})

test('json reporter with outputFile', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const outputFile = resolve('report.json')
  const context = getContext()
  context.vitest.config.outputFile = outputFile
  const testModules = getTestModules()

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(beautify(readFileSync(outputFile, 'utf8'))).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('json reporter with outputFile object', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const outputFile = resolve('report_object.json')
  const context = getContext()
  context.vitest.config.outputFile = {
    json: outputFile,
  }
  const testModules = getTestModules()

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(beautify(readFileSync(outputFile, 'utf8'))).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('json reporter with outputFile in non-existing directory', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const rootDirectory = resolve('jsonReportDirectory')
  const outputFile = `${rootDirectory}/deeply/nested/report.json`
  const context = getContext()
  context.vitest.config.outputFile = outputFile
  const testModules = getTestModules()

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(beautify(readFileSync(outputFile, 'utf8'))).toMatchSnapshot()

  // Cleanup
  rmSync(rootDirectory, { recursive: true })
})

test('json reporter with outputFile object in non-existing directory', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const rootDirectory = resolve('jsonReportDirectory_object')
  const outputFile = `${rootDirectory}/deeply/nested/report.json`
  const context = getContext()
  context.vitest.config.outputFile = {
    json: outputFile,
  }
  const testModules = getTestModules()

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onTestRunEnd(testModules)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(beautify(readFileSync(outputFile, 'utf8'))).toMatchSnapshot()

  // Cleanup
  rmSync(rootDirectory, { recursive: true })
})

/**
 * Ensure environment and OS specific paths are consistent in snapshots
 */
function normalizeCwd(text: string) {
  return text.replace(normalize(process.cwd()), '<process-cwd>')
}
