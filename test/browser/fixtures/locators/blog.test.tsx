import { expect, test } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import Blog from '../../src/blog-app/blog'

test('renders blog posts', async () => {
  const screen = await page.render(<Blog />)

  await expect.element(screen.getByRole('heading', { name: 'Blog' })).toBeInTheDocument()

  const posts = screen.getByRole('listitem').all()

  expect(posts).toHaveLength(4)

  const [firstPost, secondPost] = posts

  expect(firstPost.element()).toMatchTextContent(/molestiae ut ut quas/)
  expect(firstPost.getByRole('heading').element()).toMatchTextContent(/occaecati excepturi/)

  await expect.element(secondPost.getByRole('heading')).toMatchTextContent('qui est esse')

  await userEvent.click(secondPost.getByRole('button', { name: 'Delete' }))

  expect(screen.getByRole('listitem').all()).toHaveLength(3)

  expect(screen.getByRole('listitem').nth(0).element()).toMatchTextContent(/molestiae ut ut quas/)
  await expect.element(screen.getByRole('listitem').nth(666)).not.toBeInTheDocument()
  expect(screen.getByRole('listitem').first().element()).toMatchTextContent(/molestiae ut ut quas/)
  expect(screen.getByRole('listitem').last().element()).toMatchTextContent(/eum et est/)

  expect(screen.getByPlaceholder('non-existing').query()).not.toBeInTheDocument()
})
