import type { Plugin } from 'vite'
import remapping from '@ampproject/remapping'
import MagicString from 'magic-string'
import { defineWorkspace } from 'vitest/config'

export default defineWorkspace([
  'space_2',
  './space_*/vitest.config.ts',
  './space_1/*.config.ts',
  async () => ({
    test: {
      name: 'happy-dom',
      root: './space_shared',
      environment: 'happy-dom',
      setupFiles: ['./setup.jsdom.ts'],
      provide: {
        providedConfigValue: 'actual config value',
      },
    },
  }),
  Promise.resolve({
    test: {
      name: 'node',
      root: './space_shared',
      environment: 'node',
      setupFiles: ['./setup.node.ts'],
    },
  }),

  // Projects testing pool and poolOptions
  {
    test: {
      name: 'Threads pool',
      include: [
        './space-pools/threads.test.ts',
        './space-pools/multi-worker.test.ts',
        './space-pools/isolate.test.ts',
      ],
      pool: 'threads',
    },
  },
  {
    test: {
      name: 'Single thread pool',
      include: [
        './space-pools/threads.test.ts',
        './space-pools/single-worker.test.ts',
      ],
      pool: 'threads',
      poolOptions: { threads: { singleThread: true } },
    },
  },
  {
    test: {
      name: 'Non-isolated thread pool #1',
      include: [
        './space-pools/threads.test.ts',
        './space-pools/no-isolate.test.ts',
      ],
      pool: 'threads',
      poolOptions: { threads: { isolate: false } },
    },
  },
  {
    test: {
      name: 'Non-isolated thread pool #2',
      include: [
        './space-pools/threads.test.ts',
        './space-pools/no-isolate.test.ts',
      ],
      pool: 'threads',
      isolate: false,
    },
  },
  {
    test: {
      name: 'Forks pool',
      include: [
        './space-pools/forks.test.ts',
        './space-pools/multi-worker.test.ts',
        './space-pools/isolate.test.ts',
      ],
      pool: 'forks',
    },
  },
  {
    test: {
      name: 'Single fork pool',
      include: [
        './space-pools/forks.test.ts',
        './space-pools/single-worker.test.ts',
      ],
      pool: 'forks',
      poolOptions: { forks: { singleFork: true } },
    },
  },
  {
    test: {
      name: 'Non-isolated fork pool #1',
      include: [
        './space-pools/forks.test.ts',
        './space-pools/no-isolate.test.ts',
      ],
      pool: 'forks',
      poolOptions: { forks: { isolate: false } },
    },
  },
  {
    test: {
      name: 'Non-isolated fork pool #2',
      include: [
        './space-pools/forks.test.ts',
        './space-pools/no-isolate.test.ts',
      ],
      pool: 'forks',
      isolate: false,
    },
  },

  // These two projects run on same environment but still transform
  // a single file differently due to Vite plugins
  {
    plugins: [customPlugin(0)],
    test: {
      name: 'Project with custom plugin #1',
      environment: 'node',
      include: ['./space-multi-transform/test/project-1.test.ts'],
    },
  },
  {
    plugins: [customPlugin(15)],
    test: {
      name: 'Project with custom plugin #2',
      environment: 'node',
      include: ['./space-multi-transform/test/project-2.test.ts'],
    },
  },
])

function customPlugin(offset: number): Plugin {
  return {
    name: 'vitest-custom-multi-transform',
    enforce: 'pre',
    transform(code, id) {
      if (id.includes('space-multi-transform/src/multi-transform.ts')) {
        const padding = '\n*****'.repeat(offset)

        const transformed = new MagicString(code)
        transformed.replace('\'default-padding\'', `\`${padding}\``)

        const map = remapping(
          [transformed.generateMap({ hires: true }), this.getCombinedSourcemap() as any],
          () => null,
        ) as any

        return { code: transformed.toString(), map }
      }
    },
  }
}
