import { Request, Response } from 'express'
import { z } from 'zod'
import { VehicleType } from '@prisma/client'
import prisma from '../utils/prisma'

export async function getAllOrders(req: Request, res: Response): Promise<void> {
  const { page = '1', limit = '20', status } = req.query as Record<string, string>
  const skip = (parseInt(page) - 1) * parseInt(limit)

  const where = status ? { status: status as any } : {}

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where, skip, take: parseInt(limit),
      orderBy: { createdAt: 'desc' },
      include: {
        client: { select: { id: true, name: true } },
        driver: { select: { id: true, name: true } },
      },
    }),
    prisma.order.count({ where }),
  ])

  res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) })
}

export async function getAllDrivers(req: Request, res: Response): Promise<void> {
  const drivers = await prisma.user.findMany({
    where: { role: 'DRIVER' },
    select: {
      id: true, name: true, email: true, phone: true,
      active: true, profilePic: true,
      vehicle: true, driverStatus: true,
    },
  })
  res.json(drivers)
}

export async function approveDriver(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id)
  const user = await prisma.user.update({
    where: { id },
    data:  { active: true },
    select: { id: true, name: true, active: true },
  })
  // También verificar su vehículo
  await prisma.vehicle.updateMany({
    where: { driverId: id },
    data:  { verified: true },
  })
  res.json(user)
}

export async function getTariffs(_req: Request, res: Response): Promise<void> {
  const tariffs = await prisma.tariff.findMany()
  res.json(tariffs)
}

export async function updateTariff(req: Request, res: Response): Promise<void> {
  const Schema = z.object({
    vehicleType: z.nativeEnum(VehicleType),
    basePrice:   z.number().positive(),
    pricePerKm:  z.number().positive(),
  })
  const parsed = Schema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }

  const tariff = await prisma.tariff.upsert({
    where:  { vehicleType: parsed.data.vehicleType },
    update: { basePrice: parsed.data.basePrice, pricePerKm: parsed.data.pricePerKm },
    create: parsed.data,
  })
  res.json(tariff)
}

export async function getStats(_req: Request, res: Response): Promise<void> {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)

  const [ordenesHoy, totalIngresos, driversActivos] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: hoy } } }),
    prisma.order.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum:  { totalPrice: true },
    }),
    prisma.driverStatus.count({ where: { available: true } }),
  ])

  res.json({
    ordenesHoy,
    ingresosTotales: totalIngresos._sum.totalPrice ?? 0,
    driversActivos,
  })
}
