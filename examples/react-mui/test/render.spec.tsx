import '@testing-library/jest-dom/vitest'
import { render, screen } from './testUtils'

test('simple render', () => {
  render(<div>Hello</div>)

  expect(screen.getByText('Hello')).toBeInTheDocument()
})
