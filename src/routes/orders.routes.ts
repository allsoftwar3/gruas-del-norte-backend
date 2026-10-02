import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import {
  create, getById, accept, arrived,
  startService, complete, cancel, history,
} from '../controllers/orders.controller'

const router = Router()

router.use(authMiddleware)

router.post('/',                  requireRole('CLIENT'), create)
router.get('/history',            history)
router.get('/:id',                getById)
router.put('/:id/accept',         requireRole('DRIVER'), accept)
router.put('/:id/arrived',        requireRole('DRIVER'), arrived)
router.put('/:id/start',          requireRole('DRIVER'), startService)
router.put('/:id/complete',       requireRole('DRIVER'), complete)
router.put('/:id/cancel',         cancel)

export default router
