import '@testing-library/jest-dom'

describe('extend works', () => {
  it('toBeInTheDocument', () => {
    const div = document.createElement('div')

    expect(div).not.toBeInTheDocument()

    document.body.appendChild(div)

    expect(div).toBeInTheDocument()
  })

  it('toBeChecked', () => {
    const input = document.createElement('input')
    input.type = 'checkbox'
    document.body.appendChild(input)

    expect(input).not.toBeChecked()

    input.checked = true

    expect(input).toBeChecked()
  })

  it('toHaveStyle', () => {
    const input = document.createElement('input')
    input.style.background = 'black'
    document.body.appendChild(input)

    expect(input).toHaveStyle({ background: 'black' })
  })
})
