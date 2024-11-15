import type { GlobalSetupContext } from 'vitest/node'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { getConfig } from '@ark/attest/internal/config.js'

const config = getConfig()

// TODO(attest): for now we use cli since running `setup` repeatedly doesn't work
// (probably ts server fs in memory is stale and we can invalidate on re-run via vfs.updateFile?)
// import { setup } from "@ark/attest";

async function setup() {
  if (config.skipTypes) {
    return
  }
  mkdirSync('.attest/assertions', { recursive: true })
  execFileSync('node', ['../node_modules/@ark/attest/out/cli/cli.js', 'precache', '.attest/assertions/typescript.json'], {
    stdio: 'inherit',
  })
}

export default async (ctx: GlobalSetupContext) => {
  await setup()

  ctx.onTestsRerun(async () => {
    await setup();
  });
}
