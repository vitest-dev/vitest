import { describe, expect, it } from 'vitest';
import getLetter from './index';
describe('getLetter', () => {
  const result = getLetter();
  it('should return c', () => {
    expect(result).toBe('c');
  });
});
