import { Router } from 'express'
import { getQuote } from '../controllers/quotes.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

router.post('/', authMiddleware, getQuote)

export default router
