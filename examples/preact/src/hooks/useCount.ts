import { useCallback, useState } from 'preact/hooks'

export function useCount() {
  const [count, setCount] = useState(0)
  const inc = useCallback(() => setCount(x => x + 1), [])
  return {
    count,
    inc,
  }
}
