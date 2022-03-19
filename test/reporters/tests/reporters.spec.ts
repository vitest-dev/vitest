import { existsSync, readFileSync, rmSync } from 'fs'
import { afterEach, expect, test, vi } from 'vitest'
import { normalize, resolve } from 'pathe'
import { JsonReporter } from '../../../packages/vitest/src/node/reporters/json'
import { JUnitReporter } from '../../../packages/vitest/src/node/reporters/junit'
import { TapReporter } from '../../../packages/vitest/src/node/reporters/tap'
import { TapFlatReporter } from '../../../packages/vitest/src/node/reporters/tap-flat'
import { getContext } from '../src/context'
import { files } from '../src/data'

afterEach(() => {
  vi.useRealTimers()
})

test('tap reporter', async() => {
  // Arrange
  const reporter = new TapReporter()
  const context = getContext()

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('tap-flat reporter', async() => {
  // Arrange
  const reporter = new TapFlatReporter()
  const context = getContext()

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(context.output).toMatchSnapshot()
})

test('JUnit reporter', async() => {
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

test('JUnit reporter with outputFile', async() => {
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
  const output = context.output.replace(normalize(process.cwd()), '<process-cwd>')
  expect(output).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})

test('json reporter', async() => {
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

test('json reporter with outputFile', async() => {
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
  const output = context.output.replace(normalize(process.cwd()), '<process-cwd>')
  expect(output).toMatchSnapshot()
  expect(existsSync(outputFile)).toBe(true)
  expect(readFileSync(outputFile, 'utf8')).toMatchSnapshot()

  // Cleanup
  rmSync(outputFile)
})
