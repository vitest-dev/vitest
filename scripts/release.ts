#!/usr/bin/env tsx

import { versionBump } from 'bumpp'
import { glob } from 'tinyglobby'

const packages = await glob(['package.json', './packages/*/package.json'], {
  expandDirectories: false,
})

console.log('Bumping versions in packages:', packages.join(', '), '\n')

await versionBump({
  files: packages,
  release: process.env.RELEASE_VERSION || process.env.RELEASE_TYPE || 'next',
  commit: 'chore: release v%s',
  tag: false,
  push: false,
  confirm: false,
  interface: false,
})

console.log('New release commit is ready. Push a prepare branch and open a release PR instead of creating the final tag locally.')
