import * as React from 'react'
import fetch from 'cross-fetch'
import { gql, useLazyQuery } from '@apollo/client'

interface Post {
  userId: number
  id: number
  title: string
  body: string
}

function App() {
  const [posts, setPosts] = React.useState<Post[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  const fetchPosts = async () => {
    setIsLoading(true)
    await fetch('https://jsonplaceholder.typicode.com/posts')
      .then(res => res.json())
      .then(posts => setPosts(posts as Post[]))

    setIsLoading(false)
  }

  // GraphQL API
  const GET_POSTS = gql`
    query posts {
  posts{
    userId
    id
    title
    body
  }
}
  `
  const [postsGql, setPostsGql] = React.useState<Post[]>([])
  const [runQuery, { loading, data }] = useLazyQuery(GET_POSTS, { onCompleted: () => setPostsGql(data?.posts) })

  return (
    <main className="App">
      <h1>MSW Testing Library Example</h1>
      {isLoading && <span aria-label="loading">Loading...</span>}
      {posts.length > 0 && posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.body}</p>
        </article>
      ))}
      <button onClick={() => fetchPosts()}>Fetch Posts</button>

      {loading && <span aria-label="loading">Loading...</span>}
      {postsGql.length > 0 && postsGql.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.body}</p>
        </article>
      ))}
      <button onClick={() => runQuery()}>Fetch Posts GraphQL</button>
    </main>
  )
}

export default App
