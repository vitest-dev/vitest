import { beforeEach, describe, expect, it, vi } from 'vitest'
import { CatsController } from '../src/cats.controller'
import type { Cat } from '../src/cats.service'
import { CatsService } from '../src/cats.service'

describe('CatsController', () => {
  let catsController: CatsController
  let catsService: CatsService

  beforeEach(() => {
    catsService = new CatsService()
    catsController = new CatsController(catsService)
  })

  describe('findAll', () => {
    it('should return an array of cats', async () => {
      const result = ['test'] as unknown as Cat[]
      vi.spyOn(catsService, 'findAll').mockImplementation(() => result)

      expect(await catsController.findAll()).toBe(result)
    })
  })
})
