import { afterEach, describe, test } from 'vitest';

describe('afterEach hooks fail', () => {
  // @ts-ignore expects a function
  afterEach('fail')
  test.todo('todo')
})
