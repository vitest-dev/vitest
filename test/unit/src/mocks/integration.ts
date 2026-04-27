import { useJwt } from '@vueuse/integrations/useJwt'
import { ref } from 'vue'

export function createStore() {
  const encoded = ref('123')
  const { payload } = useJwt(encoded)

  return { payload }
}
