import { TapReporter } from '../../../packages/vitest/src/node/reporters/tap'
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