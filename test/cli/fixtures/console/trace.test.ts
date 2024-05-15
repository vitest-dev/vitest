import { test } from 'vitest';

test('logging to stdout', () => {
  console.log('log with trace')
  console.info('info with trace')
  console.debug('debug with trace')
  console.dir({ hello: 'from dir with trace' })
  console.warn('warn with trace')
  console.assert(false, 'assert with trace')
  console.error('error with trace')
  console.trace('trace with trace')
})
