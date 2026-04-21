import { expect } from 'vitest';

// Valid string terminator sequences are BEL, ESC\, and 0x9c
const ST = '(?:\\u0007|\\u001B\\u005C|\\u009C)';
const pattern = [
  `[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?${ST})`,
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
].join('|');

const ansiRegexp = new RegExp(pattern, 'g');

function stripAnsi(string: string) {
	return string.replace(ansiRegexp, '');
}

expect.addSnapshotSerializer({
  test: (val) => typeof val === 'string' || val instanceof Error,
  print: (val: string | Error) => typeof val === 'string'
    ? stripAnsi(val)
    : `[${val.name}: ${stripAnsi(val.message)}]`,
})
