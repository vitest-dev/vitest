import { defineComponent, ref, watchEffect } from 'vue'

export default defineComponent({
  name: 'TestComponent',
  props: {
    value: String,
  },
  emits: ['update:value'],
  setup(props, { emit }) {
    const local = ref('')

    watchEffect(() => {
      emit('update:value', local)
    })
    watchEffect(() => {
      local.value = props.value!
    })

    return {
      local,
    }
  },
  render() {
    return (
      <a-select v-model={[this.local, 'value']}>
        <a-select-option value="aaa">aaa</a-select-option>
      </a-select>
    )
  },
})
