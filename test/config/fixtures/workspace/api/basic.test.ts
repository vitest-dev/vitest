import { expect, it } from 'vitest';

it('correctly inherits values', ({ task }) => {
  const project = task.file.projectName
  switch (project) {
    case 'project-1': {
      expect(process.env.TEST_ROOT).toBe('1')
      return
    }
    case 'project-2': {
      expect(process.env.TEST_ROOT).toBe('2')
      return
    }
    case 'project-3': {
      // even if not inherited from the config directly, the `env` is always inherited from root
      expect(process.env.TEST_ROOT).toBe('1')
      expect(process.env.TEST_PROJECT).toBe('project-3')
      return
    }
    default: {
      expect.unreachable()
    }
  }
})
