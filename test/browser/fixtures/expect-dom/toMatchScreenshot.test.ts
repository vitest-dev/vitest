import { describe, expect, test } from 'vitest'
import { render } from './utils'
import { page } from '@vitest/browser/context'

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
    const {queryByTestId} = renderTestCase(['#ff0000', '#00ff00', '#0000ff'])

    await page.viewport(blockSize * blocks, blockSize)

    await expect(queryByTestId('rgb-box')).toMatchScreenshot('rgb-box')
  })

  test.fails('fails when screenshots don\'t match', async () => {
    const {queryByTestId} = renderTestCase(['#ff00ff', '#00ff00', '#0000ff'])

    await page.viewport(blockSize * blocks, blockSize)

    await expect(queryByTestId('rgb-box')).toMatchScreenshot('rgb-box')
  })
})
