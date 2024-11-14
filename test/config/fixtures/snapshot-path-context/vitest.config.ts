import { join, dirname, basename } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    resolveSnapshotPath(path, extension, context) {
      return join(
        dirname(path),
        '__snapshots__',
        context.config.name ?? 'na',
        basename(path) + extension
      );
    },
  },
});
