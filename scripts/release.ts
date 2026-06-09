#!/usr/bin/env tsx

import { versionBump } from 'bumpp'
import { glob } from 'tinyglobby'

const packages = await glob(['package.json', './packages/*/package.json'], {
  expandDirectories: false,
})

console.log('Bumping versions in packages:', packages.join(', '), '\n')

const release = process.env.RELEASE_VERSION || process.env.RELEASE_TYPE

await versionBump({
  files: packages,
  release,
  tag: false,
  push: false,
  confirm: !release,
})
