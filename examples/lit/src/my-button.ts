import { css, html, LitElement } from 'lit'
import { customElement, property } from 'lit/decorators.js'

/**
 * An example button.
 *
 * @slot - This button has a slot
 */
@customElement('my-button')
export class MyButton extends LitElement {
  static styles = css`
    :host {
      display: block;
      border: solid 1px gray;
      padding: 16px;
      max-width: 800px;
    }
  `

  /**
   * The name to say "Hello" to.
   */
  @property()
  name = 'World'

  /**
   * The number of times the button has been clicked.
   */
  @property({ type: Number })
  count = 1

  render() {
    return html`
      <h1>Hello, ${this.name}!</h1>
      <button @click=${this._onClick} role="button">
        Click Count: ${this.count}
      </button>
      <slot></slot>
    `
  }

  private _onClick() {
    this.count++
    this.dispatchEvent(new CustomEvent('count', { detail: this.count }))
  }

  foo(): string {
    return 'foo'
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'my-button': MyButton
  }
}
