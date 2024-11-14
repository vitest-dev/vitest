import { existsSync, readFileSync, rmSync } from 'node:fs'
import { normalize, resolve } from 'pathe'
import { beforeEach, expect, test, vi } from 'vitest'
import { JsonReporter } from '../../../packages/vitest/src/node/reporters/json'
import { JUnitReporter } from '../../../packages/vitest/src/node/reporters/junit'
import { TapReporter } from '../../../packages/vitest/src/node/reporters/tap'
import { TapFlatReporter } from '../../../packages/vitest/src/node/reporters/tap-flat'
import { getContext } from '../src/context'
import { files, passedFiles } from '../src/data'

const beautify = (json: string) => JSON.parse(json)

vi.mock('os', () => ({
  hostname: () => 'hostname',
}))

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

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('tap-flat reporter', async () => {
  // Arrange
  const reporter = new TapFlatReporter()
  const context = getContext()

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter', async () => {
  // Arrange
  const reporter = new JUnitReporter({})
  const context = getContext()

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished([])

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter without classname', async () => {
  // Arrange
  const reporter = new JUnitReporter({})
  const context = getContext()

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onFinished(passedFiles)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter with custom string classname', async () => {
  // Arrange
  const reporter = new JUnitReporter({ classname: 'my-custom-classname' })
  const context = getContext()

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onFinished(passedFiles)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter with custom function classnameTemplate', async () => {
  // Arrange
  const reporter = new JUnitReporter({ classnameTemplate: task => `filename:${task.filename} - filepath:${task.filepath}` })
  const context = getContext()

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onFinished(passedFiles)

  // Assert
  expect(context.output).toMatchSnapshot()
})
test('JUnit reporter with custom string classnameTemplate', async () => {
  // Arrange
  const reporter = new JUnitReporter({ classnameTemplate: `filename:{filename} - filepath:{filepath}` })
  const context = getContext()

  // Act
  await reporter.onInit(context.vitest)

  await reporter.onFinished(passedFiles)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter (no outputFile entry)', async () => {
  // Arrange
  const reporter = new JUnitReporter({})
  const context = getContext()
  context.vitest.config.outputFile = {}

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished([])

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter with outputFile', async () => {
  // Arrange
  const reporter = new JUnitReporter({})
  const outputFile = resolve('report.xml')
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile object', async () => {
  // Arrange
  const reporter = new JUnitReporter({})
  const outputFile = resolve('report_object.xml')
  const context = getContext()
  context.vitest.config.outputFile = {
    junit: outputFile,
  }

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile in non-existing directory', async () => {
  // Arrange
  const reporter = new JUnitReporter({})
  const rootDirectory = resolve('junitReportDirectory')
  const outputFile = `${rootDirectory}/deeply/nested/report.xml`
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile object in non-existing directory', async () => {
  // Arrange
  const reporter = new JUnitReporter({})
  const rootDirectory = resolve('junitReportDirectory_object')
  const outputFile = `${rootDirectory}/deeply/nested/report.xml`
  const context = getContext()
  context.vitest.config.outputFile = {
    junit: outputFile,
  }

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished([])

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('json reporter', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const context = getContext()

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(JSON.parse(context.output)).toMatchSnapshot()
})

test('json reporter (no outputFile entry)', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const context = getContext()
  context.vitest.config.outputFile = {}

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(JSON.parse(context.output)).toMatchSnapshot()
})

test('json reporter with outputFile', async () => {
  // Arrange
  const reporter = new JsonReporter({})
  const outputFile = resolve('report.json')
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

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

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

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

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

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

  vi.setSystemTime(1642587001759)

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

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
