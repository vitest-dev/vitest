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

export class LocationFilterFileNotFoundError extends Error {
  code = 'VITEST_LOCATION_FILTER_FILE_NOT_FOUND'

  constructor(filename: string) {
    super(`Couldn\'t find file ${filename}. Note when specifying the test `
      + 'location you have to specify the full test filename.')
  }
}

export class IncludeTaskLocationDisabledError extends Error {
  code = 'VITEST_INCLUDE_TASK_LOCATION_DISABLED'

  constructor() {
    super('Received line number filters while `includeTaskLocation` option is disabled')
  }
}

export class RangeLocationFilterProvidedError extends Error {
  code = 'VITEST_RANGE_LOCATION_FILTER_PROVIDED'

  constructor(filter: string) {
    super(`Found "-" in location filter ${filter}.  Note that range location filters `
      + `are not supported.  Consider specifying the exact line numbers of your tests.`)
  }
}

export class VitestFilteredOutProjectError extends Error {
  code = 'VITEST_FILTERED_OUT_PROJECT'

  constructor() {
    super('VITEST_FILTERED_OUT_PROJECT')
  }
}
