import { describe, expect, it } from 'vitest'
import { render, screen, userEvent } from './utils/test-utils'
import App from './App'

describe('Simple working test', () => {
  it('the title is visible', () => {
    render(<App />)
    expect(screen.getByText(/Hello Vite \+ React!/i)).toBeDefined()
  })

  it('should increment count on click', () => {
    render(<App />)
    userEvent.click(screen.getByRole('button'))
    expect(screen.findByText(/count is: 1/i)).toBeDefined()
  })
})
