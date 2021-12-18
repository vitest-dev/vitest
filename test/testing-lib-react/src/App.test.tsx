import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('Simple working test', () => {
  it('the title is visible', async () => {
    await render(<App />)
    expect(screen.getByText(/Hello Vite \+ React!/i)).toBeTruthy()
  })

  it('should increment count on click', async () => {
    await render(<App />)
    const button = screen.getByTestId('count-button')
    fireEvent.click(button)
    await waitFor(() => {
      expect(screen.getByText(/count is: 1/i)).toBeTruthy()
    })
  })
})
