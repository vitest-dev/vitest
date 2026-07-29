import { mocker } from 'virtual:mocker'
import { mocked } from './test'

mocker.customMock(import('./test'), () => {
  return { mocked: true }
})

document.querySelector('#mocked').textContent = mocked
