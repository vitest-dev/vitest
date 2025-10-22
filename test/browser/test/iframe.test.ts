import { expect, test } from 'vitest'
import { page, server } from 'vitest/browser'

test.runIf(server.provider === 'playwright')('locates an iframe', async () => {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-testid', 'iframe')
  iframe.srcdoc = '<div onclick="console.log">Hello World!</div>'
  document.body.append(iframe)
  const frame = page.frameLocator(
    page.getByTestId('iframe'),
  )

  await frame.getByText('Hello World').click()
  await expect.element(frame.getByText('Hello World')).toHaveTextContent('Hello World')
})
