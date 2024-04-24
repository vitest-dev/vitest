import { describe, expect, it, vi } from 'vitest'
import { CatsController } from '../src/cats.controller'
import type { Cat } from '../src/cats.service'
import { CatsService } from '../src/cats.service'

describe('CatsController', () => {
  describe('findAll', () => {
    it('should return an array of cats', async () => {
      const catsService = new CatsService()
      const catsController = new CatsController(catsService)

      const result = ['test'] as unknown as Cat[]
      vi.spyOn(catsService, 'findAll').mockImplementation(() => result)

      expect(await catsController.findAll()).toBe(result)
    })
  })
})
