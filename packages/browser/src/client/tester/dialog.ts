function showPopupWarning<T>(name: string, value: T, defaultValue?: T) {
  return (...params: any[]) => {
    const formattedParams = params.map(p => JSON.stringify(p)).join(', ')

    console.warn(`Vitest encountered a \`${name}(${formattedParams})\` call that it cannot handle by default, so it returned \`${value}\`. Read more in https://vitest.dev/guide/browser/#thread-blocking-dialogs.
If needed, mock the \`${name}\` call manually like:

\`\`\`
import { expect, vi } from "vitest"

vi.spyOn(window, "${name}")${
  defaultValue ? `.mockReturnValue(${JSON.stringify(defaultValue)})` : ''
}
${name}(${formattedParams})
expect(${name}).toHaveBeenCalledWith(${formattedParams})
\`\`\``)
    return value
  }
}

export function setupDialogsSpy() {
  globalThis.alert = showPopupWarning('alert', undefined)
  globalThis.confirm = showPopupWarning('confirm', false, true)
  globalThis.prompt = showPopupWarning('prompt', null, 'your value')
}
