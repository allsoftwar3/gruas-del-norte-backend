import { Request, Response } from 'express'
import { z } from 'zod'
import { VehicleType } from '@prisma/client'
import prisma from '../utils/prisma'
import redis from '../utils/redis'

const VehicleSchema = z.object({
  type:   z.nativeEnum(VehicleType),
  brand:  z.string().min(1),
  model:  z.string().min(1),
  year:   z.number().int().min(1990).max(new Date().getFullYear() + 1),
  plates: z.string().min(2),
})

export async function toggleAvailability(req: Request, res: Response): Promise<void> {
  const { available } = z.object({ available: z.boolean() }).parse(req.body)

  const status = await prisma.driverStatus.upsert({
    where:  { driverId: req.user!.userId },
    update: { available },
    create: { driverId: req.user!.userId, available },
  })

  // Guardar disponibilidad en Redis para acceso rápido
  if (available) {
    await redis.set(`driver:available:${req.user!.userId}`, '1', 'EX', 3600)
  } else {
    await redis.del(`driver:available:${req.user!.userId}`)
  }

  res.json({ available: status.available })
}

export async function registerVehicle(req: Request, res: Response): Promise<void> {
  const parsed = VehicleSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }

  const vehicle = await prisma.vehicle.upsert({
    where:  { driverId: req.user!.userId },
    update: { ...parsed.data, verified: false },
    create: { driverId: req.user!.userId, ...parsed.data },
  })
  res.json(vehicle)
}

export async function getMyVehicle(req: Request, res: Response): Promise<void> {
  const vehicle = await prisma.vehicle.findUnique({
    where: { driverId: req.user!.userId },
  })
  if (!vehicle) {
    res.status(404).json({ error: 'Vehículo no registrado' })
    return
  }
  res.json(vehicle)
}

export async function getMyStats(req: Request, res: Response): Promise<void> {
  const driverId = req.user!.userId
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [todayOrders, earningsAgg] = await Promise.all([
    prisma.order.count({
      where: { driverId, status: 'COMPLETED', completedAt: { gte: startOfDay } },
    }),
    prisma.order.aggregate({
      where: { driverId, status: 'COMPLETED', completedAt: { gte: startOfDay } },
      _sum: { totalPrice: true },
    }),
  ])

  res.json({
    todayOrders,
    dailyEarnings: earningsAgg._sum.totalPrice ?? 0,
  })
}

export async function getAvailableDrivers(req: Request, res: Response): Promise<void> {
  const { vehicleType } = z.object({ vehicleType: z.nativeEnum(VehicleType) }).parse(req.query)

  const drivers = await prisma.user.findMany({
    where: {
      role:   'DRIVER',
      active: true,
      driverStatus: { available: true },
      vehicle: { type: vehicleType, verified: true },
    },
    select: {
      id: true, name: true, phone: true, profilePic: true,
      vehicle: true, driverStatus: true,
    },
  })

  res.json(drivers)
}
