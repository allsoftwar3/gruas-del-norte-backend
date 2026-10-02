import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { createRating } from '../controllers/ratings.controller'

const router = Router()

router.post('/', authMiddleware, createRating)

export default router
