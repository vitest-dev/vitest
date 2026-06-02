import { describe, expect, it } from 'vitest'
import { parseCjsConditions } from '../../../packages/vitest/src/runtime/vm/commonjs-executor'

describe('parseCjsConditions', () => {
  it('returns default conditions with no arguments', () => {
    const result = parseCjsConditions([], undefined)
    expect(result).toEqual(new Set(['node', 'require', 'node-addons']))
  })

  it('parses --conditions=value from execArgv', () => {
    const result = parseCjsConditions(['--conditions=custom'], undefined)
    expect(result).toEqual(new Set(['node', 'require', 'node-addons', 'custom']))
  })

  it('parses --conditions value (space-separated) from execArgv', () => {
    const result = parseCjsConditions(['--conditions', 'custom'], undefined)
    expect(result).toEqual(new Set(['node', 'require', 'node-addons', 'custom']))
  })

  it('parses -C=value from execArgv', () => {
    const result = parseCjsConditions(['-C=custom'], undefined)
    expect(result).toEqual(new Set(['node', 'require', 'node-addons', 'custom']))
  })

  it('parses -C value (space-separated) from execArgv', () => {
    const result = parseCjsConditions(['-C', 'custom'], undefined)
    expect(result).toEqual(new Set(['node', 'require', 'node-addons', 'custom']))
  })

  it('parses conditions from NODE_OPTIONS', () => {
    const result = parseCjsConditions([], '--conditions=custom')
    expect(result).toEqual(new Set(['node', 'require', 'node-addons', 'custom']))
  })

  it('parses space-separated conditions from NODE_OPTIONS', () => {
    const result = parseCjsConditions([], '--conditions custom')
    expect(result).toEqual(new Set(['node', 'require', 'node-addons', 'custom']))
  })

  it('handles multiple conditions from both sources', () => {
    const result = parseCjsConditions(
      ['--conditions=from-cli', '-C', 'another'],
      '--conditions=from-env',
    )
    expect(result).toEqual(new Set([
      'node',
      'require',
      'node-addons',
      'from-cli',
      'another',
      'from-env',
    ]))
  })

  it('filters out module-sync', () => {
    const result = parseCjsConditions(['--conditions=module-sync'], undefined)
    expect(result).toEqual(new Set(['node', 'require', 'node-addons']))
  })

  it('filters out module-sync but keeps other conditions', () => {
    const result = parseCjsConditions(
      ['--conditions=module-sync', '--conditions=custom'],
      undefined,
    )
    expect(result).toEqual(new Set(['node', 'require', 'node-addons', 'custom']))
  })

  it('ignores unrelated execArgv entries', () => {
    const result = parseCjsConditions(
      ['--experimental-vm-modules', '-e', 'console.log("hi")'],
      undefined,
    )
    expect(result).toEqual(new Set(['node', 'require', 'node-addons']))
  })

  it('ignores trailing --conditions with no value', () => {
    const result = parseCjsConditions(['--conditions'], undefined)
    expect(result).toEqual(new Set(['node', 'require', 'node-addons']))
  })
})
