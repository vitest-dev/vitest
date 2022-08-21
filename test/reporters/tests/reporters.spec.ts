import { existsSync, readFileSync, rmSync, rmdirSync } from 'fs'
import { afterEach, expect, test, vi } from 'vitest'
import { normalize, resolve } from 'pathe'
import { JsonReporter } from '../../../packages/vitest/src/node/reporters/json'
import { JUnitReporter } from '../../../packages/vitest/src/node/reporters/junit'
import { TapReporter } from '../../../packages/vitest/src/node/reporters/tap'
import { TapFlatReporter } from '../../../packages/vitest/src/node/reporters/tap-flat'
import { getContext } from '../src/context'
import { createSuiteHavingFailedTestWithXmlInError, files } from '../src/data'

afterEach(() => {
  vi.useRealTimers()
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
  const reporter = new JUnitReporter()
  const context = getContext()

  vi.mock('os', () => ({
    hostname: () => 'hostname',
  }))

  vi.setSystemTime(1642587001759)

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter (no outputFile entry)', async () => {
  // Arrange
  const reporter = new JUnitReporter()
  const context = getContext()
  context.vitest.config.outputFile = {}

  vi.mock('os', () => ({
    hostname: () => 'hostname',
  }))

  vi.setSystemTime(1642587001759)

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter with outputFile', async () => {
  // Arrange
  const reporter = new JUnitReporter()
  const outputFile = resolve('report.xml')
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  vi.mock('os', () => ({
    hostname: () => 'hostname',
  }))

  vi.setSystemTime(1642587001759)

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile with XML in error details', async () => {
  // Arrange
  const reporter = new JUnitReporter()
  const outputFile = resolve('report.xml')
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  vi.mock('os', () => ({
    hostname: () => 'hostname',
  }))

  vi.setSystemTime(1642587001759)

  // setup test with failed test with xml
  const filesWithTestHavingXmlInError = createSuiteHavingFailedTestWithXmlInError()

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished(filesWithTestHavingXmlInError)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile object', async () => {
  // Arrange
  const reporter = new JUnitReporter()
  const outputFile = resolve('report_object.xml')
  const context = getContext()
  context.vitest.config.outputFile = {
    junit: outputFile,
  }

  vi.mock('os', () => ({
    hostname: () => 'hostname',
  }))

  vi.setSystemTime(1642587001759)

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('JUnit reporter with outputFile in non-existing directory', async () => {
  // Arrange
  const reporter = new JUnitReporter()
  const rootDirectory = resolve('junitReportDirectory')
  const outputFile = `${rootDirectory}/deeply/nested/report.xml`
  const context = getContext()
  context.vitest.config.outputFile = outputFile

  vi.mock('os', () => ({
    hostname: () => 'hostname',
  }))

  vi.setSystemTime(1642587001759)

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmdirSync(rootDirectory, { recursive: true })
})

test('JUnit reporter with outputFile object in non-existing directory', async () => {
  // Arrange
  const reporter = new JUnitReporter()
  const rootDirectory = resolve('junitReportDirectory_object')
  const outputFile = `${rootDirectory}/deeply/nested/report.xml`
  const context = getContext()
  context.vitest.config.outputFile = {
    junit: outputFile,
  }

  vi.mock('os', () => ({
    hostname: () => 'hostname',
  }))

  vi.setSystemTime(1642587001759)

  // Act
  await reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(normalizeCwd(context.output)).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmdirSync(rootDirectory, { recursive: true })
})

test('json reporter', async () => {
  // Arrange
  const reporter = new JsonReporter()
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
  const reporter = new JsonReporter()
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
  const reporter = new JsonReporter()
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
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('json reporter with outputFile object', async () => {
  // Arrange
  const reporter = new JsonReporter()
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
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('json reporter with outputFile in non-existing directory', async () => {
  // Arrange
  const reporter = new JsonReporter()
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
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmdirSync(rootDirectory, { recursive: true })
})

test('json reporter with outputFile object in non-existing directory', async () => {
  // Arrange
  const reporter = new JsonReporter()
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
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmdirSync(rootDirectory, { recursive: true })
})

/**
 * Ensure environment and OS specific paths are consistent in snapshots
 */
function normalizeCwd(text: string) {
  return text.replace(normalize(process.cwd()), '<process-cwd>')
}
