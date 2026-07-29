export class Gardener {
  _state = 'wake up'

  states: string[] = [this._state]

  get state() {
    return this._state
  }

  set state(state: string) {
    this._state = state
    this.states.push(state)
  }

  putWorkingClothes() {
    this.state = 'working clothes'
  }

  weedTheGrass() {
    this.state = 'weed the grass'
  }

  mowerTheLawn() {
    this.state = 'mower the lawn'
  }

  waterFlowers() {
    this.state = 'water flowers'
  }

  rest() {
    this.state = 'rest'
  }

  standup() {
    this.state = 'standup'
  }

  goHome() {
    this.state = 'home'
  }
}
