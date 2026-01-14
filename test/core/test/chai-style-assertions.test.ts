/* eslint-disable ts/no-unused-expressions */
import { describe, expect, it, vi } from 'vitest'

describe('Chai-style assertions', () => {
  describe('called', () => {
    it('passes when spy was called', () => {
      const spy = vi.fn()
      spy()
      expect(spy).to.have.been.called
    })

    it('fails when spy was not called', () => {
      const spy = vi.fn().mockName('testSpy')
      expect(() => {
        expect(spy).to.have.been.called
      }).toThrow(/expected "testSpy" to be called at least once/)
    })

    it('negated: passes when spy was not called', () => {
      const spy = vi.fn()
      expect(spy).to.not.have.been.called
    })

    it('negated: fails when spy was called', () => {
      const spy = vi.fn().mockName('testSpy')
      spy()
      expect(() => {
        expect(spy).to.not.have.been.called
      }).toThrow(/expected "testSpy" to not be called at all/)
    })
  })

  describe('callCount', () => {
    it('passes when spy was called exact number of times', () => {
      const spy = vi.fn()
      spy()
      spy()
      spy()
      expect(spy).to.have.callCount(3)
    })

    it('fails when spy was called different number of times', () => {
      const spy = vi.fn().mockName('testSpy')
      spy()
      spy()
      expect(() => {
        expect(spy).to.have.callCount(3)
      }).toThrow(/expected "testSpy" to be called 3 times, but got 2 times/)
    })

    it('negated: passes when spy was called different number of times', () => {
      const spy = vi.fn()
      spy()
      expect(spy).to.not.have.callCount(3)
    })
  })

  describe('calledWith', () => {
    it('passes when spy was called with specific arguments', () => {
      const spy = vi.fn()
      spy('arg1', 'arg2')
      expect(spy).to.have.been.calledWith('arg1', 'arg2')
    })

    it('passes when spy was called with arguments among other calls', () => {
      const spy = vi.fn()
      spy('other')
      spy('arg1', 'arg2')
      spy('another')
      expect(spy).to.have.been.calledWith('arg1', 'arg2')
    })

    it('fails when spy was not called with specific arguments', () => {
      const spy = vi.fn().mockName('testSpy')
      spy('wrong', 'args')
      expect(() => {
        expect(spy).to.have.been.calledWith('arg1', 'arg2')
      }).toThrow(/expected "testSpy" to be called with arguments/)
    })

    it('negated: passes when spy was not called with specific arguments', () => {
      const spy = vi.fn()
      spy('other', 'args')
      expect(spy).to.not.have.been.calledWith('arg1', 'arg2')
    })
  })

  describe('calledOnce', () => {
    it('passes when spy was called exactly once', () => {
      const spy = vi.fn()
      spy()
      expect(spy).to.have.been.calledOnce
    })

    it('fails when spy was not called', () => {
      const spy = vi.fn().mockName('testSpy')
      expect(() => {
        expect(spy).to.have.been.calledOnce
      }).toThrow(/expected "testSpy" to be called once, but got 0 times/)
    })

    it('fails when spy was called multiple times', () => {
      const spy = vi.fn().mockName('testSpy')
      spy()
      spy()
      expect(() => {
        expect(spy).to.have.been.calledOnce
      }).toThrow(/expected "testSpy" to be called once, but got 2 times/)
    })

    it('negated: passes when spy was not called once', () => {
      const spy = vi.fn()
      spy()
      spy()
      expect(spy).to.not.have.been.calledOnce
    })
  })

  describe('calledOnceWith', () => {
    it('passes when spy was called exactly once with specific arguments', () => {
      const spy = vi.fn()
      spy('arg1', 'arg2')
      expect(spy).to.have.been.calledOnceWith('arg1', 'arg2')
    })

    it('fails when spy was called once but with wrong arguments', () => {
      const spy = vi.fn().mockName('testSpy')
      spy('wrong', 'args')
      expect(() => {
        expect(spy).to.have.been.calledOnceWith('arg1', 'arg2')
      }).toThrow(/expected "testSpy" to be called once with arguments/)
    })

    it('fails when spy was called multiple times with correct arguments', () => {
      const spy = vi.fn().mockName('testSpy')
      spy('arg1', 'arg2')
      spy('arg1', 'arg2')
      expect(() => {
        expect(spy).to.have.been.calledOnceWith('arg1', 'arg2')
      }).toThrow(/expected "testSpy" to be called once with arguments/)
    })

    it('negated: passes when spy was not called once with specific arguments', () => {
      const spy = vi.fn()
      spy('arg1', 'arg2')
      spy('arg1', 'arg2')
      expect(spy).to.not.have.been.calledOnceWith('arg1', 'arg2')
    })
  })

  describe('lastCalledWith', () => {
    it('passes when last call was with specific arguments', () => {
      const spy = vi.fn()
      spy('first')
      spy('second')
      spy('arg1', 'arg2')
      expect(spy).to.have.been.lastCalledWith('arg1', 'arg2')
    })

    it('fails when last call was with different arguments', () => {
      const spy = vi.fn().mockName('testSpy')
      spy('arg1', 'arg2')
      spy('different')
      expect(() => {
        expect(spy).to.have.been.lastCalledWith('arg1', 'arg2')
      }).toThrow(/expected last "testSpy" call to have been called with/)
    })

    it('negated: passes when last call was with different arguments', () => {
      const spy = vi.fn()
      spy('arg1', 'arg2')
      spy('different')
      expect(spy).to.not.have.been.lastCalledWith('arg1', 'arg2')
    })
  })

  describe('nthCalledWith', () => {
    it('passes when nth call was with specific arguments', () => {
      const spy = vi.fn()
      spy('first')
      spy('arg1', 'arg2')
      spy('third')
      expect(spy).to.have.been.nthCalledWith(2, 'arg1', 'arg2')
    })

    it('fails when nth call was with different arguments', () => {
      const spy = vi.fn().mockName('testSpy')
      spy('first')
      spy('wrong')
      spy('third')
      expect(() => {
        expect(spy).to.have.been.nthCalledWith(2, 'arg1', 'arg2')
      }).toThrow(/expected 2nd "testSpy" call to have been called with/)
    })

    it('negated: passes when nth call was with different arguments', () => {
      const spy = vi.fn()
      spy('first')
      spy('wrong')
      spy('third')
      expect(spy).to.not.have.been.nthCalledWith(2, 'arg1', 'arg2')
    })
  })

  describe('returned', () => {
    it('passes when spy returned successfully', () => {
      const spy = vi.fn(() => 'value')
      spy()
      expect(spy).to.have.returned
    })

    it('fails when spy threw an error', () => {
      const spy = vi.fn(() => {
        throw new Error('test error')
      }).mockName('testSpy')
      try {
        spy()
      }
      catch {}
      expect(() => {
        expect(spy).to.have.returned
      }).toThrow(/expected "testSpy" to be successfully called at least once/)
    })

    it('negated: passes when spy did not return', () => {
      const spy = vi.fn(() => {
        throw new Error('test error')
      })
      try {
        spy()
      }
      catch {}
      expect(spy).to.not.have.returned
    })
  })

  describe('returnedWith', () => {
    it('passes when spy returned specific value', () => {
      const spy = vi.fn(() => 'value')
      spy()
      expect(spy).to.have.returnedWith('value')
    })

    it('passes when spy returned value among other calls', () => {
      const spy = vi.fn()
      spy.mockReturnValueOnce('other')
      spy.mockReturnValueOnce('value')
      spy.mockReturnValueOnce('another')
      spy()
      spy()
      spy()
      expect(spy).to.have.returnedWith('value')
    })

    it('fails when spy did not return specific value', () => {
      const spy = vi.fn(() => 'wrong').mockName('testSpy')
      spy()
      expect(() => {
        expect(spy).to.have.returnedWith('value')
      }).toThrow(/expected "testSpy"/)
    })

    it('negated: passes when spy did not return specific value', () => {
      const spy = vi.fn(() => 'other')
      spy()
      expect(spy).to.not.have.returnedWith('value')
    })
  })

  describe('calledBefore', () => {
    it('passes when spy was called before another spy', () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()
      spy1()
      spy2()
      expect(spy1).to.have.been.calledBefore(spy2)
    })

    it('fails when spy was called after another spy', () => {
      const spy1 = vi.fn().mockName('spy1')
      const spy2 = vi.fn().mockName('spy2')
      spy2()
      spy1()
      expect(() => {
        expect(spy1).to.have.been.calledBefore(spy2)
      }).toThrow(/expected "spy1" to have been called before "spy2"/)
    })

    it('negated: passes when spy was not called before another spy', () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()
      spy2()
      spy1()
      expect(spy1).to.not.have.been.calledBefore(spy2)
    })
  })

  describe('calledAfter', () => {
    it('passes when spy was called after another spy', () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()
      spy2()
      spy1()
      expect(spy1).to.have.been.calledAfter(spy2)
    })

    it('fails when spy was called before another spy', () => {
      const spy1 = vi.fn().mockName('spy1')
      const spy2 = vi.fn().mockName('spy2')
      spy1()
      spy2()
      expect(() => {
        expect(spy1).to.have.been.calledAfter(spy2)
      }).toThrow(/expected "spy1" to have been called after "spy2"/)
    })

    it('negated: passes when spy was not called after another spy', () => {
      const spy1 = vi.fn()
      const spy2 = vi.fn()
      spy1()
      spy2()
      expect(spy1).to.not.have.been.calledAfter(spy2)
    })
  })

  describe('returnedTimes', () => {
    it('passes when spy returned successfully exact number of times', () => {
      const spy = vi.fn(() => 'value')
      spy()
      spy()
      spy()
      expect(spy).to.have.returnedTimes(3)
    })

    it('fails when spy returned different number of times', () => {
      const spy = vi.fn(() => 'value').mockName('testSpy')
      spy()
      spy()
      expect(() => {
        expect(spy).to.have.returnedTimes(3)
      }).toThrow(/expected "testSpy"/)
    })

    it('negated: passes when spy returned different number of times', () => {
      const spy = vi.fn(() => 'value')
      spy()
      expect(spy).to.not.have.returnedTimes(3)
    })

    it('does not count throws as returns', () => {
      const spy = vi.fn(() => {
        throw new Error('error')
      })
      expect(() => spy()).toThrow()
      expect(() => spy()).toThrow()
      expect(spy).to.have.returnedTimes(0)
    })
  })

  describe('lastReturnedWith', () => {
    it('passes when last return value matches', () => {
      const spy = vi.fn()
        .mockReturnValueOnce('first')
        .mockReturnValueOnce('second')
        .mockReturnValueOnce('last')
      spy()
      spy()
      spy()
      expect(spy).to.have.lastReturnedWith('last')
    })

    it('fails when last return value does not match', () => {
      const spy = vi.fn(() => 'wrong').mockName('testSpy')
      spy()
      expect(() => {
        expect(spy).to.have.lastReturnedWith('expected')
      }).toThrow(/expected last "testSpy" call to return/)
    })

    it('negated: passes when last return value does not match', () => {
      const spy = vi.fn(() => 'actual')
      spy()
      expect(spy).to.not.have.lastReturnedWith('different')
    })
  })

  describe('nthReturnedWith', () => {
    it('passes when nth return value matches', () => {
      const spy = vi.fn()
        .mockReturnValueOnce('first')
        .mockReturnValueOnce('second')
        .mockReturnValueOnce('third')
      spy()
      spy()
      spy()
      expect(spy).to.have.nthReturnedWith(2, 'second')
    })

    it('fails when nth return value does not match', () => {
      const spy = vi.fn(() => 'wrong').mockName('testSpy')
      spy()
      spy()
      expect(() => {
        expect(spy).to.have.nthReturnedWith(2, 'expected')
      }).toThrow(/expected 2nd call "testSpy" call to return/)
    })

    it('negated: passes when nth return value does not match', () => {
      const spy = vi.fn()
        .mockReturnValueOnce('first')
        .mockReturnValueOnce('second')
      spy()
      spy()
      expect(spy).to.not.have.nthReturnedWith(2, 'different')
    })
  })

  describe('calledTwice', () => {
    it('passes when spy was called exactly twice', () => {
      const spy = vi.fn()
      spy()
      spy()
      expect(spy).to.have.been.calledTwice
    })

    it('fails when spy was not called twice', () => {
      const spy = vi.fn().mockName('testSpy')
      spy()
      expect(() => {
        expect(spy).to.have.been.calledTwice
      }).toThrow(/expected "testSpy" to be called 2 times, but got 1 times/)
    })

    it('negated: passes when spy was not called twice', () => {
      const spy = vi.fn()
      spy()
      expect(spy).to.not.have.been.calledTwice
    })

    it('fails when spy was called three times', () => {
      const spy = vi.fn().mockName('testSpy')
      spy()
      spy()
      spy()
      expect(() => {
        expect(spy).to.have.been.calledTwice
      }).toThrow(/expected "testSpy" to be called 2 times, but got 3 times/)
    })
  })

  describe('calledThrice', () => {
    it('passes when spy was called exactly three times', () => {
      const spy = vi.fn()
      spy()
      spy()
      spy()
      expect(spy).to.have.been.calledThrice
    })

    it('fails when spy was not called three times', () => {
      const spy = vi.fn().mockName('testSpy')
      spy()
      spy()
      expect(() => {
        expect(spy).to.have.been.calledThrice
      }).toThrow(/expected "testSpy" to be called 3 times, but got 2 times/)
    })

    it('negated: passes when spy was not called three times', () => {
      const spy = vi.fn()
      spy()
      spy()
      expect(spy).to.not.have.been.calledThrice
    })

    it('fails when spy was called twice', () => {
      const spy = vi.fn().mockName('testSpy')
      spy()
      spy()
      expect(() => {
        expect(spy).to.have.been.calledThrice
      }).toThrow(/expected "testSpy" to be called 3 times, but got 2 times/)
    })
  })
})
