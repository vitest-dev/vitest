export class FilesNotFoundError extends Error {
  code = 'VITEST_FILES_NOT_FOUND'

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

export class IncludeTaskLocationDisabledError extends Error {
  code = 'VITEST_INCLUDE_TASK_LOCATION_DISABLED'

  constructor() {
    super('Recieved line number filters while `includeTaskLocation` option is disabled')
  }
}
