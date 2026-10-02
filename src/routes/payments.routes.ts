import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { createIntent, webhook, refund } from '../controllers/payments.controller'

const router = Router()

router.post('/webhook',        webhook)
router.post('/create-intent',  authMiddleware, createIntent)
router.post('/refund',         authMiddleware, refund)

export default router
