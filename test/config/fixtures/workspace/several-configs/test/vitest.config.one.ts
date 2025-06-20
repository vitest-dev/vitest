import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '1_test',
    include: ['./1_test.test.ts'],
  }
})
