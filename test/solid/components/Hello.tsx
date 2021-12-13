import { createSignal } from 'solid-js';

export const Hello = (props: { count: number }) => {
  const [times, setTimes] = createSignal(2);
  return <>
    <div>{`${props.count} x ${times} = ${props.count * times()}`}</div>
    <button onClick={() => setTimes(t => t + 1)}>x1</button>
  </>
};
