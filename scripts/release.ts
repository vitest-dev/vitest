#!/usr/bin/env zx

import { versionBump } from 'bumpp'
import { glob } from 'tinyglobby'
import { $ } from 'zx'

try {
  const packages = await glob(['package.json', './packages/*/package.json'], { expandDirectories: false })

  console.log('Bumping versions in packages:', packages.join(', '), '\n')

  const result = await versionBump({
    files: packages,
    commit: true,
    push: true,
    tag: true,
  })

  if (!result.newVersion.includes('beta')) {
    console.log('Pushing to release branch')
    await $`git update-ref refs/heads/release refs/heads/main`
    await $`git push origin release`
  }
  console.log('New release is ready, waiting for conformation at https://github.com/vitest-dev/vitest/actions')
}
catch (err) {
  console.error(err)
}
