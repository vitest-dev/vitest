import sinon from 'sinon'

export { sinon }
export const { mock, spy, stub } = sinon

// @ts-expect-error
sinon.fn = sinon.spy
