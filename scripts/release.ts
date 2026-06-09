#!/usr/bin/env zx

import { versionBump } from 'bumpp'
import { glob } from 'tinyglobby'

try {
  const packages = await glob(['package.json', './packages/*/package.json'], { expandDirectories: false })

  console.log('Bumping versions in packages:', packages.join(', '), '\n')

  await versionBump({
    files: packages,
    commit: true,
    push: true,
    tag: false,
  })

  console.log('New release commit is ready. Push a prepare branch and open a release PR instead of creating the final tag locally.')
}
catch (err) {
  console.error(err)
}
