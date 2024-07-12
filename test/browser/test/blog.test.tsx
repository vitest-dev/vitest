import { expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { page } from '@vitest/browser/context'
import Blog from '../src/blog-app/blog'

test('renders blog posts', async () => {
  render(<Blog />)

  await expect.element(page.getByRole('heading', { name: 'Blog' })).toBeInTheDocument()

  const posts = page.getByRole('listitem').all()

  expect(posts).toHaveLength(4)

  const [firstPost, secondPost] = posts

  expect(firstPost.element()).toHaveTextContent(/molestiae ut ut quas/)
  expect(firstPost.getByRole('heading').element()).toHaveTextContent(/occaecati excepturi/)

  await expect.element(secondPost.getByRole('heading')).toHaveTextContent('qui est esse')

  await secondPost.getByRole('button', { name: 'Delete' }).click()

  expect(page.getByRole('listitem').all()).toHaveLength(3)

  expect(page.getByPlaceholder('non-existing').query()).not.toBeInTheDocument()
})
