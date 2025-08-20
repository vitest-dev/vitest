/**
 * Test utilities for VITEST_WATCH environment variable testing
 */

// Helper function to safely set/unset environment variables
export function withEnv(env: Record<string, string | undefined>, fn: () => void | Promise<void>) {
  const original: Record<string, string | undefined> = {}

  // Store original values
  for (const [key, value] of Object.entries(env)) {
    original[key] = process.env[key]
    if (value === undefined) {
      delete process.env[key]
    }
    else {
      process.env[key] = value
    }
  }

  try {
    return fn()
  }
  finally {
    // Restore original values
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key]
      }
      else {
        process.env[key] = value
      }
    }
  }
}

// Mock TTY for testing
export function mockTTY(isTTY: boolean) {
  const original = process.stdin.isTTY
  process.stdin.isTTY = isTTY
  return () => {
    process.stdin.isTTY = original
  }
}

// Mock CI environment
export function mockCI(isCI: boolean) {
  const original = process.env.CI

  if (isCI) {
    process.env.CI = '1'
  } else {
    delete process.env.CI
  }

  // Also mock other CI environment variables that std-env might check
  const originalGithubActions = process.env.GITHUB_ACTIONS
  const originalGitlabCI = process.env.GITLAB_CI
  const originalCircleCI = process.env.CIRCLECI
  const originalTravisCI = process.env.TRAVIS
  const originalJenkinsCI = process.env.JENKINS_URL

  if (!isCI) {
    delete process.env.GITHUB_ACTIONS
    delete process.env.GITLAB_CI
    delete process.env.CIRCLECI
    delete process.env.TRAVIS
    delete process.env.JENKINS_URL
  }

  return () => {
    if (original === undefined) {
      delete process.env.CI
    }
    else {
      process.env.CI = original
    }

    if (originalGithubActions === undefined) {
      delete process.env.GITHUB_ACTIONS
    }
    else {
      process.env.GITHUB_ACTIONS = originalGithubActions
    }

    if (originalGitlabCI === undefined) {
      delete process.env.GITLAB_CI
    }
    else {
      process.env.GITLAB_CI = originalGitlabCI
    }

    if (originalCircleCI === undefined) {
      delete process.env.CIRCLECI
    }
    else {
      process.env.CIRCLECI = originalCircleCI
    }

    if (originalTravisCI === undefined) {
      delete process.env.TRAVIS
    }
    else {
      process.env.TRAVIS = originalTravisCI
    }

    if (originalJenkinsCI === undefined) {
      delete process.env.JENKINS_URL
    }
    else {
      process.env.JENKINS_URL = originalJenkinsCI
    }
  }
}

// Helper to create a simple test fixture
export function createSimpleTestFixture() {
  return {
    'simple.test.ts': `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`,
  }
}

// Helper to create a config override fixture
export function createConfigOverrideFixture() {
  return {
    'vitest.config.ts': `
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    watch: true, // This should be overridden by VITEST_WATCH=false
  },
})
`,
    'simple.test.ts': `
import { test, expect } from 'vitest'

test('simple test', () => {
  expect(1 + 1).toBe(2)
})
`,
  }
}
