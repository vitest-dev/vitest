import * as React from 'react'
import { gql, useLazyQuery } from '@apollo/client'

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

type Post = {
  userId: number
  id: number
  title: string
  body: string
}

function App() {
  const [posts, setPosts] = React.useState<Post[]>([])
  const [runQuery, { loading, data }] = useLazyQuery(GET_POSTS, { onCompleted: () => setPosts(data?.posts) })

  return (
    <main className="App">
      <h1>MSW Testing Library Example</h1>
      {loading && <span aria-label="loading">Loading...</span>}
      {posts.length > 0 && posts.map(post => (
        <article key={post.id}>
          <h2>{post.title}</h2>
          <p>{post.body}</p>
        </article>
      ))}
      <button onClick={() => runQuery()}>Fetch Posts</button>
    </main>
  )
}

export default App
