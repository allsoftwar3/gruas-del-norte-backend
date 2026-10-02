import { Router } from 'express'
import { register, login, me, updateFcmToken } from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth.middleware'

const router = Router()

router.post('/register',   register)
router.post('/login',      login)
router.get('/me',          authMiddleware, me)
router.put('/fcm-token',   authMiddleware, updateFcmToken)

export default router
