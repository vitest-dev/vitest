// eslint-disable-next-line no-console
console.log('deps')

export {}

import.meta.hot && import.meta.hot.accept(() => {
  // eslint-disable-next-line no-console
  console.log('[deps.ts] hot reload!')
})
