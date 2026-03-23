import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { cdp, server } from 'vitest/browser'

describe.runIf(
  server.provider === 'playwright' && server.browser === 'chromium',
)('cdp in chromium browsers', () => {
  it('cdp sends events correctly', async () => {
    const messageAdded = vi.fn()

    await cdp().send('Console.enable')

    cdp().on('Console.messageAdded', messageAdded)

    onTestFinished(async () => {
      await cdp().send('Console.disable')
    })

    console.error('MESSAGE ADDED')

    await vi.waitFor(() => {
      expect(messageAdded).toHaveBeenCalledWith({
        message: expect.objectContaining({
          column: expect.any(Number),
          text: 'MESSAGE ADDED',
          source: 'console-api',
          url: expect.any(String),
        }),
      })
    })
  })

  it('cdp keyboard works correctly', async () => {
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    await cdp().send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      text: 'a',
    })
    expect(input).toHaveValue('a')

    await cdp().send('Input.insertText', {
      text: 'some text',
    })
    expect(input).toHaveValue('asome text')
  })

  it('click events are fired correctly', async () => {
    const clickEvent = vi.fn()
    document.body.addEventListener('click', clickEvent)

    const parent = window.top
    const iframePosition = parent.document.querySelector('iframe').getBoundingClientRect()

    await cdp().send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: iframePosition.x + 10,
      y: iframePosition.y + 10,
      button: 'left',
      clickCount: 1,
    })
    await cdp().send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: iframePosition.x + 10,
      y: iframePosition.y + 10,
      button: 'left',
      clickCount: 1,
    })

    expect(clickEvent).toHaveBeenCalledOnce()
  })
})
