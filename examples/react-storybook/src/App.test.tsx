import { render, screen } from '@testing-library/react'
import { composeStories } from '@storybook/testing-react'
import { posts } from './mockData'
import * as stories from './App.stories'

const { Loading, Data, Error } = composeStories(stories)

it('renders in the loading state', () => {
  render(<Loading />)
  expect(
    screen.getByRole('heading', {
      name: /storybook testing example/i,
      level: 1,
    }),
  ).toBeInTheDocument()

  expect(screen.getByLabelText(/loading/i)).toBeInTheDocument()
})

it('renders with data', async () => {
  render(<Data />)
  expect(
    screen.getByRole('heading', {
      name: /storybook testing example/i,
      level: 1,
    }),
  ).toBeInTheDocument()

  for (const post of posts) {
    expect(
      await screen.findByRole('heading', { name: post.title, level: 2 }),
    ).toBeDefined()
    expect(screen.getByText(post.body)).toBeDefined()
  }
})

it('handles errors', async () => {
  render(<Error />)
  expect(
    screen.getByRole('heading', {
      name: /storybook testing example/i,
      level: 1,
    }),
  ).toBeInTheDocument()

  expect(await screen.findByText(/error loading posts/i)).toBeInTheDocument()
})
