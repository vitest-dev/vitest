import { page } from '@vitest/browser/context'
import { test } from 'vitest'

test('locates an iframe', async () => {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-testid', 'iframe')
  iframe.srcdoc = '<div onclick="console.log">Hello World!</div>'
  document.body.append(iframe)
  const frame = page.frameLocator(
    page.getByTestId('iframe'),
  )

  await frame.getByText('Hello World').click()
})
