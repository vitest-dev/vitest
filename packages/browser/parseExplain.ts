import { readFileSync, writeFileSync } from 'node:fs';
import { styleText } from 'node:util'

// { dep: ['dep2'], dep2: [] }
const dependencies: Record<string, string[]> = {}
const content = readFileSync('./explainTypes.txt', 'utf-8').split('\n')

let lastKey = content[0]
for (let i = 1; i < content.length; i++) {
  const line = content[i]
  if (line.startsWith(' ')) {
    const line = content[i].trim()
    if (!line.startsWith('Imported via')) {
      continue
    }

    const [_, __, from] = (line.includes('with')
      ? /Imported via '(.*)' from file '(.*)' with/.exec(line)
      : /Imported via '(.*)' from file '(.*)'/.exec(line)) ?? []

    dependencies[from] ??= []
    if (!dependencies[from].includes(lastKey)) {
      dependencies[from].push(lastKey)
    }
  } else {
    lastKey = content[i]
  }
}

const start = 'src/client/tester/public-utils.ts'
const startNode = dependencies[start]

// console.log(dependencies)

function printTree(start: string, deps: string[], depth = 1, seen = new Set()) {
  for (const dep of deps) {
    if (seen.has(dep)) {
      continue
    }
    seen.add(dep)
    console.log('  '.repeat(depth) + (dep.includes('vitest/src/public/node.ts') ? styleText('red', dep) : dep))
    const deps = dependencies[dep]
    if (!deps || dep.includes('node_modules')) {
      // console.log('no deps', dep)
    } else {
      printTree(start, deps, depth + 1, seen)
    }
  }
}

for (const key in dependencies) {
  if (key.startsWith('src/client/tester/runner.ts')) {
    console.log(key)
    printTree(key, dependencies[key])
  }
}

// writeFileSync('tsDeps.json', JSON.stringify(dependencies, null, 2), 'utf-8')