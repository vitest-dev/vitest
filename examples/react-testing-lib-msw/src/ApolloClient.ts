import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client'

const cache = new InMemoryCache()

const link = new HttpLink({
  uri: 'https://jsonplaceholder.ir/graphql',

  // Use explicit `window.fetch` so that outgoing requests
  // are captured and deferred until the Service Worker is ready.
  fetch: (...args) => fetch(...args),
})

export const client = new ApolloClient({
  cache,
  link,
})
