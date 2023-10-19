import { tick } from 'svelte'
import { expect } from 'vitest'
import Hello from '../components/Hello.svelte'

describe('Hello.svelte', () => {
  it('mounts', () => {
    const host1 = document.createElement('div')
    host1.setAttribute('id', 'host1')
    document.body.appendChild(host1)
    const instance = new Hello({ target: host1, props: { count: 4 } })
    expect(instance).toBeDefined()
    expect(host1.innerHTML).toContain('4 x 2 = 8')
    expect(host1.innerHTML).toMatchSnapshot()
  })

  it('updates on button click', async () => {
    const host2 = document.createElement('div')
    host2.setAttribute('id', 'host2')
    document.body.appendChild(host2)
    const _instance = new Hello({ target: host2, props: { count: 4 } })
    const btn = host2.getElementsByTagName('button')[0]
    const div = host2.querySelector('div')
    expect(div).toBeDefined()
    expect(div.innerHTML).toBe('4 x 2 = 8')
    btn.click()
    await tick()
    expect(div.innerHTML).toBe('4 x 3 = 12')
    btn.click()
    await tick()
    expect(div.innerHTML).toBe('4 x 4 = 16')
  })
})

/*
//TODO improvements
    - alternatives to expect with innerHTML
 */
