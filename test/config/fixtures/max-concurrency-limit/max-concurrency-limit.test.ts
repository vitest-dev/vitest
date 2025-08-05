import { describe, test, expect, afterAll } from 'vitest'

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
declare const __CONCURRENCY_LIMIT__: number

describe(`Verifying test.concurrent respects the limit of ${__CONCURRENCY_LIMIT__}`, () => {
    let running = 0
    let maxObserved = 0

    async function track() {
        running++
        maxObserved = Math.max(maxObserved, running)
        expect(running).toBeLessThanOrEqual(__CONCURRENCY_LIMIT__)
        await delay(30)
        running--
    }

    for (let i = 1; i <= __CONCURRENCY_LIMIT__ + 10; i++)
        test.concurrent(`test #${i}`, track)

    afterAll(() => {
        const expectedMax = Math.min(__CONCURRENCY_LIMIT__, maxObserved)
        expect(maxObserved).toBe(expectedMax)
    })
})
