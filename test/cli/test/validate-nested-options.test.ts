import type { CliOptions } from '../../../packages/vitest/src/node/cli/cli-api'
import type { CLIOptions as CLIOptionsConfig } from '../../../packages/vitest/src/node/cli/cli-config'
import { expect, test } from 'vitest'
import { cliOptionsConfig } from '../../../packages/vitest/src/node/cli/cli-config'
import { validateNestedOptions } from '../../../packages/vitest/src/utils/validate-nested-options'

test('validates valid nested options without throwing', () => {
  const options: CliOptions = {
    experimental: {
      fsModuleCache: true,
      printImportBreakdown: true,
    },
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('validates valid deeply nested options without throwing', () => {
  const options: CliOptions = {
    coverage: {
      thresholds: {
        lines: 80,
        functions: 90,
        branches: 85,
        statements: 80,
      },
    },
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('throws error for invalid nested option', () => {
  const options: CliOptions = {
    experimental: {
      invalidOption: true,
    },
  } as any

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).toThrow('Unknown option "experimental.invalidOption". Did you mean one of: "experimental.fsModuleCache", "experimental.fsModuleCachePath", "experimental.openTelemetry", "experimental.printImportBreakdown"? Use \'--help --experimental\' for more info.')
})

test('throws error for invalid deeply nested option', () => {
  const options: CliOptions = {
    coverage: {
      thresholds: {
        invalidThreshold: 100,
      },
    },
  } as any

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).toThrow('Unknown option "coverage.thresholds.invalidThreshold"')
})

test('ignores null option values', () => {
  const options: CliOptions = {
    experimental: null,
  } as any

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('ignores undefined option values', () => {
  const options: CliOptions = {
    experimental: undefined,
  } as any

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('ignores array option values', () => {
  const options: CliOptions = {
    experimental: ['fsModuleCache'] as any,
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('ignores non-object option values', () => {
  const options: CliOptions = {
    experimental: 'string' as any,
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('ignores options without subcommands', () => {
  const options: CliOptions = {
    watch: true,
    root: '/some/path',
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('validates multiple nested options correctly', () => {
  const options: CliOptions = {
    experimental: {
      fsModuleCache: true,
    },
    coverage: {
      provider: 'v8',
      enabled: true,
    },
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('throws error with correct path for nested option', () => {
  const options: CliOptions = {
    coverage: {
      invalidSubcommand: true,
    },
  } as any

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).toThrow('Unknown option "coverage.invalidSubcommand"')
})

test('handles empty nested object', () => {
  const options: CliOptions = {
    experimental: {},
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('validates with custom path parameter', () => {
  const customConfig: CLIOptionsConfig<any> = {
    test: {
      description: 'Test option',
      subcommands: {
        nested: {
          description: 'Nested option',
        },
      },
    },
  }

  const options: CliOptions = {
    test: {
      nested: true,
    },
  } as any

  expect(() => {
    validateNestedOptions(options, customConfig, 'custom')
  }).not.toThrow()
})

test('throws error with custom path in error message', () => {
  const customConfig: CLIOptionsConfig<any> = {
    test: {
      description: 'Test option',
      subcommands: {
        nested: {
          description: 'Nested option',
        },
      },
    },
  }

  const options: CliOptions = {
    test: {
      invalid: true,
    },
  } as any

  expect(() => {
    validateNestedOptions(options, customConfig, 'custom')
  }).toThrow('Unknown option "custom.test.invalid"')
})

test('handles null subcommand config gracefully', () => {
  const customConfig: CLIOptionsConfig<any> = {
    test: {
      description: 'Test option',
      subcommands: {
        nested: null,
      },
    },
  }

  const options: CliOptions = {
    test: {
      nested: true,
    },
  } as any

  // Should not throw because null subcommands are skipped
  expect(() => {
    validateNestedOptions(options, customConfig)
  }).not.toThrow()
})

test('handles subcommands with null subcommands property', () => {
  const customConfig: CLIOptionsConfig<any> = {
    test: {
      description: 'Test option',
      subcommands: {
        nested: {
          description: 'Nested option',
          subcommands: null,
        },
      },
    },
  }

  const options: CliOptions = {
    test: {
      nested: {
        deep: true,
      },
    },
  } as any

  // Should not throw because nested.subcommands is null, so recursion stops
  expect(() => {
    validateNestedOptions(options, customConfig)
  }).not.toThrow()
})

test('validates complex nested structure', () => {
  const options: CliOptions = {
    experimental: {
      fsModuleCache: true,
      printImportBreakdown: true,
    },
    coverage: {
      provider: 'v8',
      enabled: true,
      thresholds: {
        lines: 80,
        functions: 90,
        perFile: true,
      },
    },
  }

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).not.toThrow()
})

test('throws error for invalid option in complex nested structure', () => {
  const options: CliOptions = {
    experimental: {
      fsModuleCache: true,
    },
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        invalidOption: 100,
      },
    },
  } as any

  expect(() => {
    validateNestedOptions(options, cliOptionsConfig)
  }).toThrow('Unknown option "coverage.thresholds.invalidOption"')
})
