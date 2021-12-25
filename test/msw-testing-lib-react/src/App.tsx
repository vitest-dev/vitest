import * as React from 'react'
import fetch from 'node-fetch'

type Post = {
  userId: number
  id: number
  title: string
  body: string
}

function App() {
  const [posts, setPosts] = React.useState<Post[]>([])
  const [isLoading, setIsLoading] = React.useState(false)

  const fetchPosts = async() => {
    setIsLoading(true)
    await fetch('https://jsonplaceholder.typicode.com/posts')
      .then(res => res.json())
      .then(posts => setPosts(posts as Post[]))

    setIsLoading(false)
  }

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
    </main>
  )
}

export default App
