if (import.meta.hot) {
  import.meta.hot.accept(() => {})
  if (import.meta.hot.data.value == null) {
    import.meta.hot.data.value = 0
  }
  else {
    // eslint-disable-next-line no-throw-literal
    throw 'some error'
  }
}
console.error('ready')
