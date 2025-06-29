function raise(error: string): never
function raise(error: Error): never
function raise(error: Error | string): never {
  if (typeof error === 'string') {
    throw new Error(error)
  } else {
    throw error
  }
}

export { raise }
