/* eslint-disable no-console */

import { render, screen, userEvent } from '../utils/test-utils'
import { Input } from './Input'

describe('Input', async () => {
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
    expect(screen.getByText('Email Address')).toBeInTheDocument()
    expect(screen.getByRole('textbox', {
      name: /email address/i,
    })).toBeInTheDocument()
  })
  it('should change input value', async () => {
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
    await userEvent.type(input, '1337')
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
    expect(screen.getByRole('textbox', {
      name: /email address/i,
    })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Please enter your email')
  })
})

describe('ui console view', () => {
  // https://github.com/vitest-dev/vitest/issues/2765
  it('regexp', () => {
    console.log('A:', /(?<char>\w)/)
    console.log('B:', /(?<char>\w)/.source)
    console.log(`C: ${/(?<char>\w)/}`)
  })

  // https://github.com/vitest-dev/vitest/issues/3934
  it('html', async () => {
    const fs = await import('node:fs')
    const file = await fs.promises.readFile('src/components/Input.tsx', 'utf-8')
    console.log(file)
  })

  // https://github.com/vitest-dev/vitest/issues/1279
  it('screen.debug', () => {
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
    screen.debug()
  })
})
