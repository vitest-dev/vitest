export function recordAsyncExpect(test: any, promise: Promise<any>) {
  // record promise for test, that resolves before test ends
  if (test) {
    // if promise is explicitly awaited, remove it from the list
    promise = promise.finally(() => {
      const index = test.promises.indexOf(promise)
      if (index !== -1)
        test.promises.splice(index, 1)
    })

    // record promise
    if (!test.promises)
      test.promises = []
    test.promises.push(promise)
  }

  return promise
}
