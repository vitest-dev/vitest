import { expect, test } from 'vitest'
import { page, userEvent } from '@vitest/browser/context'
import Blog from '../../src/blog-app/blog'

test('renders blog posts', async () => {
  const screen = page.render(<Blog />)

  await expect.element(screen.getByRole('heading', { name: 'Blog' })).toBeInTheDocument()

  const posts = screen.getByRole('listitem').all()

  expect(posts).toHaveLength(4)

  const [firstPost, secondPost] = posts

  expect(firstPost.element()).toHaveTextContent(/molestiae ut ut quas/)
  expect(firstPost.getByRole('heading').element()).toHaveTextContent(/occaecati excepturi/)

  await expect.element(secondPost.getByRole('heading')).toHaveTextContent('qui est esse')

  // TODO: click doesn't work on webdriverio when iframe is scaled
  await userEvent.click(secondPost.getByRole('button', { name: 'Delete' }))

  expect(screen.getByRole('listitem').all()).toHaveLength(3)

  expect(screen.getByPlaceholder('non-existing').query()).not.toBeInTheDocument()
})
