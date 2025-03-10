import { createContentLoader } from 'vitepress'

interface Post {
  title: string
  url: string
  date: {
    time: number
    string: string
  }
}

// TODO: the exact typed data loader pattern is not supported by rolldown/oxc
// https://vitepress.dev/guide/data-loading#typed-data-loaders
// https://github.com/rolldown/rolldown/issues/3048#issuecomment-2547371389
export declare const data: Post[]

export default createContentLoader('blog/*.md', {
  // excerpt: true,
  transform(raw): Post[] {
    return raw
      .map(({ url, frontmatter }) => ({
        title: frontmatter.head.find((e: any) => e[1].property === 'og:title')[1]
          .content,
        url,
        date: formatDate(frontmatter.date),
      }))
      .sort((a, b) => b.date.time - a.date.time)
  },
})

function formatDate(raw: string): Post['date'] {
  const date = new Date(raw)
  date.setUTCHours(12)
  return {
    time: +date,
    string: date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  }
}
