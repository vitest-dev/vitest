console.error('Hello!')

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    console.error('Accept')
  })
}
