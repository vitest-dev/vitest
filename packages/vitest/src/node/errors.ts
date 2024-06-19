export class NoTestsFoundError extends Error {
  constructor() {
    super('No tests with specified filters found.')
  }
}

export class GitNotFoundError extends Error {
  constructor() {
    super('Could not find Git root. Have you initialized git with `git init`?')
  }
}
