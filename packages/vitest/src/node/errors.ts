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

export class RangeLocationFilterProvidedError extends Error {
  code = 'VITEST_RANGE_LOCATION_FILTER_PROVIDED'

  constructor(filter: string) {
    super(`Found "-" in location filter ${filter}.  Note that range location filters `
      + `are not supported.  Consider specifying the exact line numbers of your tests.`)
  }
}
