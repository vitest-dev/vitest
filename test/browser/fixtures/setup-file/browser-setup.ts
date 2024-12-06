import { beforeEach } from 'vitest';
import * as source from './source';

beforeEach<{ source: any }>((t) => {
  t.source = source
})
