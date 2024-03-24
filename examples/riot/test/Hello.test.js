import { assert, describe, it, expect } from 'vitest'
import * as riot from 'riot'

import Hello from "../components/Hello.riot"

describe('Hello Component', () => {

    it("should mount the component", () => {
        expect(Hello).toBeTruthy()
        riot.register('c-hello', Hello);
        const [component] = riot.mount(document.createElement('div'), { count : 4 }, 'c-hello');
        
        expect(component.root.innerHTML).toContain('4 x 2 = 8')
        expect(component.root.innerHTML).toMatchSnapshot()
        riot.unregister('c-hello');
    })

    it("should updates on button click", () => {
        riot.register('c-hello', Hello);
        const [component] = riot.mount(document.createElement('div'), { count : 4 }, 'c-hello');

        console.log()
        expect(component.root.querySelector('div').innerHTML).toContain('4 x 2 = 8')
        component.root.querySelector('button').click();
        expect(component.root.querySelector('div').innerHTML).toContain('4 x 3 = 12')
        component.root.querySelector('button').click();
        expect(component.root.querySelector('div').innerHTML).toContain('4 x 4 = 16')
        riot.unregister('c-hello');
    })

})
