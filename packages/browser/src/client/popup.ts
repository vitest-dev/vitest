const showPopupWarning = <T>(name: string, value: T) => (...params: any[]) => {
  const formatedParams = params.map(p => JSON.stringify(p)).join(', ')

  console.warn(`Vitest encountered a \`${name}\` call with parameters (${formatedParams}) that it can't handle by default in the browser, so it returned \`${value}\`. Read more in https://vitest.dev/guide/browser.html#popup.
If needed, mock the \`${name}\` call manually like:

\`\`\`
import { vi } from 'vitest'

vi.spyOn(window, '${name}').mockReturnValue('your value')
${name}(${formatedParams})
expect(${name}).toHaveBeenCalled()
\`\`\``)
  return value
}

export const setupPopupSpy = () => {
  globalThis.alert = showPopupWarning('alert', null)
  globalThis.confirm = showPopupWarning('confirm', false)
  globalThis.prompt = showPopupWarning('prompt', null)
}
