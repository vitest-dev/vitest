import { beforeAll, describe, test } from 'vitest';

describe('beforeAll hooks fail', () => {
  // @ts-ignore expects a function
  beforeAll('fail')
  test.todo('todo')
})
