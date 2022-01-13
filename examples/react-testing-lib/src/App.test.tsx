import '@testing-library/jest-dom'
import App from './App'
import { render, screen, userEvent, waitFor } from './utils/test-utils'

describe('Simple working test', () => {
  it('the title is visible', () => {
    render(<App />)
    expect(screen.getByText(/Hello Vite \+ React!/i)).toBeInTheDocument()
  })

  it('should increment count on click', async() => {
    await render(<App />)
    const btn = await screen.findByRole('button')
    expect(screen.getByText(/count is: 0/i))
    userEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText(/count is: 1/i))
    })
  })
})
