import './deps.css'

// eslint-disable-next-line no-console
console.log('[deps.ts] imported')

export {}

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // eslint-disable-next-line no-console
    console.log('[deps.ts] hot reload!')
  })
}
