export class NoTestsFoundError extends Error {
  constructor(mode: 'test' | 'benchmark') {
    super(`No ${mode} files found`)
  }
}

export class GitNotFoundError extends Error {
  constructor() {
    super('Could not find Git root. Have you initialized git with `git init`?')
  }
}
