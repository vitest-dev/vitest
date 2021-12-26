import { rest } from 'msw'
import postsData from './data/posts.json'

// Define handlers that catch the corresponding requests and returns the mock data.
export const handlers = [
  rest.get('https://jsonplaceholder.typicode.com/posts', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json(postsData))
  }),
]
