import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const filepath = resolve(import.meta.dirname, './text.txt');

test('basic', () => {
  expect(readFileSync(filepath, 'utf-8')).toBe('hello world\n');
})
