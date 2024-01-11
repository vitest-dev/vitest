import {
  afterAll,
  beforeAll,
  describe,
  it,
} from 'vitest';

describe('suite with beforeAll', () => {
  beforeAll(() => {
    throw new Error('beforeAll error');
  });

  it('ok 1', () => {});
  it('ok 2', () => {});
  it.skip('skip 1', () => {});
});

describe('suite with afterAll', () => {
  afterAll(() => {
    throw new Error('afterAll error');
  });

  it('ok 1', () => {});
  it('ok 2', () => {});
  it.skip('skip 1', () => {});
});
