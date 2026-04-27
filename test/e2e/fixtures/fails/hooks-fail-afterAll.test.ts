import { describe, test, afterAll } from 'vitest';

describe('afterAll hooks fail', () => {
  // @ts-ignore expects a function
  afterAll('fail')
  test.todo('todo')
})
