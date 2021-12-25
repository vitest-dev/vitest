import { expect, it } from 'vitest'
import { customRender, screen, userEvent, waitForElementToBeRemoved } from './utils/test-utils'
import App from './App'

it('Should return posts when clicking fetch button', async() => {
  customRender(<App />)

  expect(screen.getByRole('heading', { name: 'MSW Testing Library Example', level: 1 })).toBeDefined()

  userEvent.click(screen.getByRole('button', { name: 'Fetch Posts' }))

  await waitForElementToBeRemoved(() => screen.queryByLabelText('loading'))

  //   First post
  expect(screen.getByRole('heading', { name: 'first post title', level: 2 })).toBeDefined()
  expect(screen.getByText('first post body')).toBeDefined()

  //   Second post
  expect(screen.getByRole('heading', { name: 'second post title', level: 2 })).toBeDefined()
  expect(screen.getByText('second post body')).toBeDefined()

  //   First post
  expect(screen.getByRole('heading', { name: 'third post title', level: 2 })).toBeDefined()
  expect(screen.getByText('third post body')).toBeDefined()
})
