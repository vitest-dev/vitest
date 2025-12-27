import { readFileSync } from 'node:fs'

// { dep: ['dep2'], dep2: [] }
const dependencies: Record<string, string[]> = {}
const content = readFileSync(process.argv[2], 'utf-8').split('\n')

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
  }
  else {
    lastKey = content[i]
  }
}

function printTree(start: string, deps: string[], depth = 1, seen = new Set()) {
  for (const dep of deps) {
    if (seen.has(dep)) {
      continue
    }
    seen.add(dep)
    console.error('  '.repeat(depth) + dep)
    const deps = dependencies[dep]
    if (deps && !dep.includes('node_modules')) {
      printTree(start, deps, depth + 1, seen)
    }
  }
}

for (const key in dependencies) {
  if (key.startsWith('src/client')) {
    console.error(key)
    printTree(key, dependencies[key])
  }
}
