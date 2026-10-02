import { Router } from 'express'
import { authMiddleware } from '../middleware/auth.middleware'
import { requireRole } from '../middleware/role.middleware'
import { toggleAvailability, getAvailableDrivers, registerVehicle, getMyVehicle, getMyStats } from '../controllers/drivers.controller'

const router = Router()

router.use(authMiddleware)

router.post('/vehicle',      requireRole('DRIVER'), registerVehicle)
router.get('/vehicle',       requireRole('DRIVER'), getMyVehicle)
router.get('/stats',         requireRole('DRIVER'), getMyStats)
router.put('/availability',  requireRole('DRIVER'), toggleAvailability)
router.get('/available',     requireRole('ADMIN'),  getAvailableDrivers)

export default router
