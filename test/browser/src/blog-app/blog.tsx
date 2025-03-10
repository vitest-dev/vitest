import React from 'react'

interface Post {
  userId: number
  id: number
  title: string
  body: string
}

export default function App() {
  const [posts, setPosts] = React.useState<Post[]>(() => [
    {
      userId: 1,
      id: 1,
      title: 'sunt aut facere repellat provident occaecati excepturi optio reprehenderit',
      body: 'quia et suscipit\nsuscipit recusandae consequuntur expedita et cum\nreprehenderit molestiae ut ut quas totam\nnostrum rerum est autem sunt rem eveniet architecto',
    },
    {
      userId: 1,
      id: 2,
      title: 'qui est esse',
      body: 'est rerum tempore vitae\nsequi sint nihil reprehenderit dolor beatae ea dolores neque\nfugiat blanditiis voluptate porro vel nihil molestiae ut reiciendis\nqui aperiam non debitis possimus qui neque nisi nulla',
    },
    {
      userId: 1,
      id: 3,
      title: 'ea molestias quasi exercitationem repellat qui ipsa sit aut',
      body: 'et iusto sed quo iure\nvoluptatem occaecati omnis eligendi aut ad\nvoluptatem doloribus vel accusantium quis pariatur\nmolestiae porro eius odio et labore et velit aut',
    },
    {
      userId: 1,
      id: 4,
      title: 'eum et est occaecati',
      body: 'ullam et saepe reiciendis voluptatem adipisci\nsit amet autem assumenda provident rerum culpa\nquis hic commodi nesciunt rem tenetur doloremque ipsam iure\nquis sunt voluptatem rerum illo velit',
    },
  ])

  const [archive, setArchive] = React.useState<Post[]>(() => [])

  function removePost(index: number) {
    setPosts(posts => posts.filter((_, i) => i !== index))
  }

  function archivePost(index: number) {
    setArchive(archive => [...archive, posts[index]])
    removePost(index)
  }

  return (
    <div>
      <h1>Blog</h1>
      <ul>
        {posts.map((post, index) => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.body}</p>
            {/* Violation of best practices: non-unique and ambiguous test id; we will work around it with extra selectors */}
            <div>
              <button data-testid="delete-post" onClick={() => removePost(index)}>Delete</button>
              <button data-testid="delete-post" onClick={() => archivePost(index)}>Archive</button>
            </div>
          </li>
        ))}
        {archive.map(post => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.body}</p>
          </li>
        ))}
      </ul>
    </div>
  )
}
