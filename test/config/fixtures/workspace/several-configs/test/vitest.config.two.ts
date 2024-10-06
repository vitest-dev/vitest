import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: '2_test',
    include: ['./2_test.test.ts'],
  }
})
