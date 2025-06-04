import { describe, expect, test } from 'vitest'
import { render } from './utils'
import { page, server } from '@vitest/browser/context'

const blockSize = 19
const blocks = 5

const renderTestCase = (colors: readonly [string, string, string]) =>
  render(`
      <div style="--size: ${blockSize}px; display: flex; justify-content: center; height: var(--size); width: calc(var(--size) * ${blocks});" data-testid="rgb-box">
        <div style="background-color: ${colors[0]}; width: var(--size);"></div>
        <div style="background-color: ${colors[1]}; width: var(--size);"></div>
        <div style="background-color: ${colors[2]}; width: var(--size);"></div>
      </div>
    `)

describe('.toMatchScreenshot', () => {
  test('works correctly', async () => {
    const { queryByTestId } = renderTestCase(['#ff0000', '#00ff00', '#0000ff'])

    await page.viewport(blockSize * blocks, blockSize)

    await expect(queryByTestId('rgb-box')).toMatchScreenshot('rgb-box')
  })

  test('throws when screenshots don\'t match', async () => {
    const { queryByTestId } = renderTestCase(['#ff00ff', '#00ff00', '#0000ff'])

    await page.viewport(blockSize * blocks, blockSize)

    let errorMessage: string

    try {
      await expect(queryByTestId('rgb-box')).toMatchScreenshot('rgb-box')
    } catch (error) {
      errorMessage = error.message
    }

    expect(errorMessage).toMatch(new RegExp(dedent(`
      expect\\(element\\)\\.toMatchScreenshot\\(\\)

      Screenshot does not match the stored reference\\.
      \\d+ pixels \\(ratio [01]\\.\\d{2}\\) differ\\.

      Reference screenshot:
        .*?[\\/]rgb-box-\\w+\\.png

      Actual screenshot:
        .*?[\\/]rgb-box-actual-\\w+\\.png
    `)))
  })

  test('throws when creating a screenshot for the first time', async ({ onTestFinished }) => {
    let path: string | undefined

    onTestFinished(async () => {
      if (path) {
        server.commands.removeFile(path)
      }
    })

    const { queryByTestId } = renderTestCase(['#ff2056', '#7ccf00', '#8e51ff'])

    let errorMessage: string

    try {
      await expect(queryByTestId('rgb-box')).toMatchScreenshot(Math.random().toString())
    } catch (error) {
      errorMessage = error.message
    }

    path = errorMessage.split('\n').at(-1).trim()

    expect(errorMessage).toMatch(new RegExp(dedent(`
      expect\\(element\\)\\.toMatchScreenshot\\(\\)

      No existing reference screenshot found.

      Reference screenshot:
        .*?\\.png
    `)))
  })
})

/**
 * Simple dedent utility. Removes the first and last newlines.
 */
const dedent = (input: string) => {
  const spaces = /(?:^[\r\n]+)?(?<spaces>\s+)/.exec(input)?.groups.spaces?.length ?? 0

  return input.replace(new RegExp(`^ {${spaces}}`, 'gm'), '').trim()
}
