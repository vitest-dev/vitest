import { Vitest } from '../../../packages/vitest/src/node'

interface Context {
    vitest: Vitest,
    output: string
}

export function getContext(): Context {
    let output = ''
    const log = (text: string) => output += text + '\n'
    const context: Partial<Vitest> = {
        log
    }

    return {
        vitest: context as Vitest,
        get output() {
            return output
        }
    }
}
