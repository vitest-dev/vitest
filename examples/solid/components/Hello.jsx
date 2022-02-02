/* eslint-disable react/prop-types */
import { createSignal } from 'solid-js'

export const Hello = (props) => {
  const [times, setTimes] = createSignal(2)
  return <>
    <div>{`${props.count} x ${times()} = ${props.count * times()}`}</div>
    <button onClick={() => setTimes(t => t + 1)}>x1</button>
  </>
}
