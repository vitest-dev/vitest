import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/preact'
import { BrowserRouter } from 'react-router-dom'

import App from './App'

describe('Preact Demo Test Suite', () => {
  it('basic', () => {
    render(<BrowserRouter><App /></BrowserRouter>)
    expect(screen.getByText(/Hello Vite & Preact!/i)).toBeInTheDocument()
  })

  it('click event', async () => {
    render(<BrowserRouter><App /></BrowserRouter>)
    fireEvent.click(screen.getByRole('button'))
    expect(await screen.findByText(/count is:\s*1/i)).toBeInTheDocument()
  })
})
