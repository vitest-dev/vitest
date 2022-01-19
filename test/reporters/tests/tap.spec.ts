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
    expect(context.output).toMatchInlineSnapshot(`
      "TAP version 13
      1..1
      not ok 1 - test/core/test/basic.test.ts # time=145.99ms {
          1..1
          ok 1 - suite # time=1.90ms {
              1..8
              ok 1 - inner suite # time=1.90ms {
                  1..1
                  not ok 1 - Math.sqrt() # time=1.44ms
                      ---
                      error:
                          name: \\"AssertionError\\"
                          message: \\"expected 2.23606797749979 to equal 2\\"
                      at: \\"/vitest/test/core/test/basic.test.ts:8:32\\"
                      actual: \\"2.23606797749979\\"
                      expected: \\"2\\"
                      ...
              }
              ok 2 - JSON # time=1.02ms
              ok 3 - async with timeout # SKIP
              ok 4 - timeout # time=100.51ms
              ok 5 - callback setup success  # time=20.18ms
              ok 6 - callback test success  # time=0.33ms
              ok 7 - callback setup success done(false) # time=19.74ms
              ok 8 - callback test success done(false) # time=0.19ms
          }
      }
      "
    `)
})