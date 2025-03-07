function render(html: string) {
  const container = document.createElement('div')
  container.innerHTML = html
  const queryByTestId = (testId: string) =>
    container.querySelector(`[data-testid="${testId}"]`) as HTMLElement | SVGElement | null
  // asFragment has been stolen from react-testing-library
  const asFragment = () =>
    document.createRange().createContextualFragment(container.innerHTML)
  const getInputByTestId = (testId: string) => queryByTestId(testId) as HTMLInputElement

  // Some tests need to look up global ids with document.getElementById()
  // so we need to be inside an actual document.
  document.body.innerHTML = ''
  document.body.appendChild(container)

  return { container, queryByTestId, asFragment, getInputByTestId }
}

export { render }
