import { createContainer, nextTick } from '../utils/test-utils'
import { Input } from './Input'

describe('Input', async () => {
  it('should render the input', async () => {
    await createContainer(
      'root1',
      <Input
        name="email"
        type="email"
        error={undefined}
        placeholder="Email"
        label="Email Address"
        aria-label="Email Address"
      />,
    )
    const input: HTMLInputElement | null = document.querySelector('#root1 input')
    expect(input).toBeDefined()
    expect(input?.name).toBe('email')
  })
  it('should change input value', async () => {
    await createContainer(
      'root2',
      <Input
        name="email"
        type="email"
        error={undefined}
        placeholder="Email"
        label="Email Address"
        aria-label="Email Address"
      />,
    )

    const input: HTMLInputElement | null = document.querySelector('#root2 input')
    expect(input).toBeDefined()
    input!.value = '1337'
    await nextTick()
    expect(input?.value).toEqual('1337')
  })
  it('should render the input with error', async () => {
    await createContainer(
      'root3',
      <Input
        name="email"
        type="email"
        placeholder="Email"
        label="Email Address"
        aria-label="Email Address"
        error="Please enter your email"
      />,
    )
    const alert: HTMLElement | null = document.querySelector('#root3 [role="alert"]')
    expect(alert).toBeDefined()
    expect(alert?.innerHTML).toBe('Please enter your email')
  })
})
