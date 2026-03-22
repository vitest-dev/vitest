/* eslint-disable ts/no-unused-expressions */
import { chai, describe, expect, it } from 'vitest'
// @ts-expect-error no type override otherwise vitest ones broken
import sinon from 'sinon'
// @ts-expect-error no
import sinonChai from 'sinon-chai'

chai.use(sinonChai)

describe('sinon-chai assertions', () => {
  describe('called', () => {
    it('passes when spy was called', () => {
      const spy = sinon.spy()
      spy()
      expect(spy).to.have.been.called
    })

    it('negated: passes when spy was not called', () => {
      const spy = sinon.spy()
      expect(spy).to.not.have.been.called
    })
  })

  describe('callCount', () => {
    it('passes when spy was called exact number of times', () => {
      const spy = sinon.spy()
      spy()
      spy()
      spy()
      expect(spy).to.have.callCount(3)
    })

    it('negated: passes when spy was called different number of times', () => {
      const spy = sinon.spy()
      spy()
      expect(spy).to.not.have.callCount(3)
    })
  })

  describe('calledWith', () => {
    it('passes when spy was called with specific arguments', () => {
      const spy = sinon.spy()
      spy('arg1', 'arg2')
      expect(spy).to.have.been.calledWith('arg1', 'arg2')
    })

    it('passes when spy was called with arguments among other calls', () => {
      const spy = sinon.spy()
      spy('other')
      spy('arg1', 'arg2')
      spy('another')
      expect(spy).to.have.been.calledWith('arg1', 'arg2')
    })

    it('negated: passes when spy was not called with specific arguments', () => {
      const spy = sinon.spy()
      spy('other', 'args')
      expect(spy).to.not.have.been.calledWith('arg1', 'arg2')
    })
  })

  describe('calledOnce', () => {
    it('passes when spy was called exactly once', () => {
      const spy = sinon.spy()
      spy()
      expect(spy).to.have.been.calledOnce
    })

    it('negated: passes when spy was not called once', () => {
      const spy = sinon.spy()
      spy()
      spy()
      expect(spy).to.not.have.been.calledOnce
    })
  })

  describe('calledOnceWith', () => {
    it('passes when spy was called exactly once with specific arguments', () => {
      const spy = sinon.spy()
      spy('arg1', 'arg2')
      expect(spy).to.have.been.calledOnceWith('arg1', 'arg2')
    })

    it('negated: passes when spy was not called once with specific arguments', () => {
      const spy = sinon.spy()
      spy('arg1', 'arg2')
      spy('arg1', 'arg2')
      expect(spy).to.not.have.been.calledOnceWith('arg1', 'arg2')
    })
  })

  describe('calledTwice', () => {
    it('passes when spy was called exactly twice', () => {
      const spy = sinon.spy()
      spy()
      spy()
      expect(spy).to.have.been.calledTwice
    })

    it('negated: passes when spy was not called twice', () => {
      const spy = sinon.spy()
      spy()
      expect(spy).to.not.have.been.calledTwice
    })
  })

  describe('calledThrice', () => {
    it('passes when spy was called exactly three times', () => {
      const spy = sinon.spy()
      spy()
      spy()
      spy()
      expect(spy).to.have.been.calledThrice
    })

    it('negated: passes when spy was not called three times', () => {
      const spy = sinon.spy()
      spy()
      spy()
      expect(spy).to.not.have.been.calledThrice
    })
  })

  describe('calledBefore / calledAfter', () => {
    it('passes when spy was called before another spy', () => {
      const spy1 = sinon.spy()
      const spy2 = sinon.spy()
      spy1()
      spy2()
      expect(spy1).to.have.been.calledBefore(spy2)
    })

    it('passes when spy was called after another spy', () => {
      const spy1 = sinon.spy()
      const spy2 = sinon.spy()
      spy1()
      spy2()
      expect(spy2).to.have.been.calledAfter(spy1)
    })
  })

  describe('returned', () => {
    it('passes when spy returned specific value', () => {
      const spy = sinon.spy(() => 'value')
      spy()
      expect(spy).to.have.returned('value')
    })

    it('passes with no arguments (checks for undefined)', () => {
      const spy = sinon.spy(() => {})
      spy()
      expect(spy).to.have.returned(undefined)
    })

    it('negated: passes when spy did not return specific value', () => {
      const spy = sinon.spy(() => 'other')
      spy()
      expect(spy).to.not.have.returned('value')
    })
  })

  // TODO: implement `thrown`
  // describe('thrown', () => {
  //   it('passes when spy threw', () => {
  //     const spy = sinon.spy(() => {
  //       throw new Error('test error')
  //     })
  //     try {
  //       spy()
  //     }
  //     catch {}
  //     expect(spy).to.have.thrown()
  //   })

  //   it('negated: passes when spy did not throw', () => {
  //     const spy = sinon.spy(() => 'value')
  //     spy()
  //     expect(spy).to.not.have.thrown()
  //   })
  // })
})
