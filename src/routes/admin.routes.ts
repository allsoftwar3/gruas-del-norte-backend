import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import {
  getAllOrders, getAllDrivers, approveDriver, setDriverStatus,
  getTariffs, updateTariff, getStats,
} from '../controllers/admin.controller'

const router = Router()

router.use(authMiddleware, requireRole('ADMIN'))

router.get('/orders',              getAllOrders)
router.get('/drivers',             getAllDrivers)
router.put('/drivers/:id/approve', approveDriver)
router.put('/drivers/:id/status',  setDriverStatus)
router.get('/tariffs',             getTariffs)
router.put('/tariffs',             updateTariff)
router.get('/stats',               getStats)

export default router
