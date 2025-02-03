#!/usr/bin/env zx

import { versionBump } from 'bumpp'
import { glob } from 'tinyglobby'

try {
  const packages = await glob(['package.json', './packages/*/package.json'], { expandDirectories: false })

  console.log('Bumping versions in packages:', packages.join(', '), '\n')

  const result = await versionBump({
    files: packages,
    commit: true,
    push: true,
    tag: true,
  })

  console.log('New release is ready, waiting for conformation at https://github.com/vitest-dev/vitest/actions')
}
catch (err) {
  console.error(err)
}
