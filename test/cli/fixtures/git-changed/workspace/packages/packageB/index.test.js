import { describe, expect, it } from 'vitest';
import getNumber from './index';
describe('getNumber', () => {
  const result = getNumber();
  it('should return 3', () => {
    expect(result).toBe(3);
  });
});
