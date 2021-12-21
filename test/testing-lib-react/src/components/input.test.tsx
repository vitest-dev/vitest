import '@testing-library/jest-dom'
import userEvent from '@testing-library/user-event'
import { render, screen } from './../utils/test-utils'
import { Input } from './Input'

describe('Input', async() => {
  it('should render the input', () => {
    render(
      <Input
        name="email"
        type="email"
        error={undefined}
        placeholder="Email"
        label="Email Address"
        aria-label="Email Address"
      />,
    )
    expect(screen.getByText('Email Address')).toBeInTheDocument() // check for the human readable label
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument()
  })
  it('should change input value', () => {
    render(
      <Input
        name="email"
        type="email"
        error={undefined}
        placeholder="Email"
        label="Email Address"
        aria-label="Email Address"
      />,
    )

    screen.logTestingPlaygroundURL()

    const input = screen.getByRole('textbox', {
      name: /email address/i,
    })
    expect(input).toBeInTheDocument()
    userEvent.type(input, '1337')
    expect(input).toHaveValue('1337')
  })
  it('should render the input with error', () => {
    render(
      <Input
        name="email"
        type="email"
        placeholder="Email"
        label="Email Address"
        aria-label="Email Address"
        error="Please enter your email"
      />,
    )
    const error = screen.getByRole('alert')
    expect(error).toHaveTextContent('Please enter your email')
  })
})
