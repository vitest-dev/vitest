import { beforeEach, describe, test } from 'vitest';

describe('beforeEach hooks fail', () => {
  // @ts-ignore expects a function
  beforeEach('fail')
  test.todo('todo')
})
