import { mocker } from 'virtual:mocker'
import { calculate } from './test'

mocker.customMock(import('./test'))

document.querySelector('#mocked').textContent = calculate(1, 2)

calculate.mockReturnValue(42)

document.querySelector('#mocked').textContent += `, ${calculate(1, 2)}`
