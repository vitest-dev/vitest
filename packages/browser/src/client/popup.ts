const showPopupWarning = (name: string) => (...params: any[]) => {
  const formatedParams = params.map(p => JSON.stringify(p)).join(', ')

  console.warn(`Vitest encountered a \`${name}\` call with parameters: ${
      formatedParams}. Vitest cannot handle \`${
      name}\` by default in the browser, so it returned null. If you need to handle this case, you can mock the \`${
      name}\` call yourself like this:

\`\`\`
vi.spyOn(window, '${name}').mockReturnValue('your value')
${name}(${formatedParams})
expect(${name}).toHaveBeenCalled()
\`\`\``)
  return null
}

export const setupPopupSpy = () => {
  globalThis.alert = showPopupWarning('alert')
  // @ts-expect-error mocking native popup apis
  globalThis.confirm = showPopupWarning('confirm')
  globalThis.prompt = showPopupWarning('prompt')
}
