import { cdp, server } from '@vitest/browser/context'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

describe.skipIf(server.provider !== 'playwright')('cdp in chromium browsers', () => {
  it('cdp sends events correctly', async () => {
    const div = document.createElement('div')
    document.body.appendChild(div)
    const messageAdded = vi.fn()

    cdp().on('Console.messageAdded', messageAdded)

    await cdp().send('Console.enable')
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
})
