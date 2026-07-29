/** @vitest-environment jsdom */

/** @vitest-environment-options { "url": "https://example.com/" } */

import { expect, it } from 'vitest'

it('parse single line environment options', () => expect(location.href).toBe('https://example.com/'))
