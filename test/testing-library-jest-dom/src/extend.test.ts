import '@testing-library/jest-dom'

describe('extend works', () => {
  it('toBeInTheDocument', () => {
    const div = document.createElement('div')

    expect(div).not.toBeInTheDocument()

    document.body.appendChild(div)

    expect(div).toBeInTheDocument()
  })
})
