import { JsonReporter } from '../../../packages/vitest/src/node/reporters/json'
import { TapReporter } from '../../../packages/vitest/src/node/reporters/tap'
import { TapFlatReporter } from '../../../packages/vitest/src/node/reporters/tap-flat'
import { getContext } from '../src/context'
import { files } from '../src/data'

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

test('json reporter', async () => {
  // Arrange
  const reporter = new JsonReporter()
  const context = getContext()

  // Act
  reporter.onInit(context.vitest)
  await reporter.onFinished(files)

  // Assert
  expect(context.output).toMatchSnapshot()
})