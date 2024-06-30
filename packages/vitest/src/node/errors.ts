export class TestsNotFoundError extends Error {
  code = 'VITEST_TESTS_NOT_FOUND'

  constructor(mode: 'test' | 'benchmark') {
    super(`No ${mode} files found`)
  }
}

export class GitNotFoundError extends Error {
  code = 'VITEST_GIT_NOT_FOUND'

  constructor() {
    super('Could not find Git root. Have you initialized git with `git init`?')
  }
}
