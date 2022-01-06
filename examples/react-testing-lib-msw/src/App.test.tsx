import { expect, it } from 'vitest'
import { render, screen, userEvent, waitForElementToBeRemoved } from './utils/test-utils'
import App from './App'
import { posts } from './mocks/handlers'

it('Should return posts when clicking fetch button', async() => {
  render(<App />)

  expect(screen.getByRole('heading', { name: 'MSW Testing Library Example', level: 1 })).toBeDefined()

  userEvent.click(screen.getByRole('button', { name: 'Fetch Posts' }))

  await waitForElementToBeRemoved(() => screen.queryByLabelText('loading'))

  posts.forEach((post) => {
    expect(screen.getByRole('heading', { name: post.title, level: 2 })).toBeDefined()
    expect(screen.getByText(post.body)).toBeDefined()
  })
})
