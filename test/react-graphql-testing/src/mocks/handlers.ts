import { graphql } from 'msw'

// Mock Data
export const posts = [
  {
    __typename: 'Post',
    userId: 1,
    id: 1,
    title: 'first post title',
    body: 'first post body',
  },
  {
    __typename: 'Post',
    userId: 2,
    id: 5,
    title: 'second post title',
    body: 'second post body',
  },
  {
    __typename: 'Post',
    userId: 3,
    id: 6,
    title: 'third post title',
    body: 'third post body',
  },
]

// Define handlers that catch the corresponding requests and returns the mock data.

export const handlers = [
  graphql.query('posts', (req, res, ctx) => {
    return res(
      ctx.data({
        posts,
      }),
    )
  }),
]
