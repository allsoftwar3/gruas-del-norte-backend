import { Request, Response } from 'express'
import { z } from 'zod'
import { VehicleType } from '@prisma/client'
import { createOrder, transitionOrder, getUserOrderHistory } from '../services/order.service'
import { io } from '../app'
import { sendOrderRequest } from '../socket/socket.handler'
import prisma from '../utils/prisma'

const CreateOrderSchema = z.object({
  vehicleType:    z.nativeEnum(VehicleType),
  originLat:      z.number(),
  originLng:      z.number(),
  originAddress:  z.string(),
  destLat:        z.number(),
  destLng:        z.number(),
  destAddress:    z.string(),
  distanceKm:     z.number().positive(),
  basePrice:      z.number().positive(),
  kmPrice:        z.number().positive(),
  totalPrice:     z.number().positive(),
})

export async function create(req: Request, res: Response): Promise<void> {
  const parsed = CreateOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }
  const order = await createOrder(req.user!.userId, parsed.data)

  // Buscar conductores disponibles con el tipo de vehículo requerido
  const availableDrivers = await prisma.user.findMany({
    where: {
      role:         'DRIVER',
      active:       true,
      driverStatus: { available: true },
      vehicle:      { type: parsed.data.vehicleType, verified: true },
    },
    select: { id: true, name: true },
  })

  // Enviar solicitud a todos los conductores disponibles (InDriver-style)
  // El primero que acepte bloquea la orden vía VALID_TRANSITIONS
  let dispatched = 0
  for (const driver of availableDrivers) {
    const sent = sendOrderRequest(io, driver.id, {
      orderId:       order.id,
      clientName:    (order as any).client?.name ?? 'Cliente',
      originAddress: parsed.data.originAddress,
      destAddress:   parsed.data.destAddress,
      distanceKm:    parsed.data.distanceKm,
      vehicleType:   parsed.data.vehicleType,
      totalPrice:    parsed.data.totalPrice,
    })
    if (sent) dispatched++
  }

  console.log(`[Order ${order.id}] Despachada a ${dispatched}/${availableDrivers.length} conductores`)
  res.status(201).json(order)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const id = String(req.params.id)
  try {
    const order = await prisma.order.findUniqueOrThrow({
      where: { id },
      include: {
        driver: { select: { id: true, name: true, phone: true, profilePic: true, vehicle: true } },
        client: { select: { id: true, name: true, phone: true } },
        rating: true,
      },
    })
    res.json(order)
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Orden no encontrada' })
      return
    }
    throw err
  }
}

export async function accept(req: Request, res: Response): Promise<void> {
  try {
    const order = await transitionOrder(String(req.params.id), 'ACCEPTED', req.user!.userId, {
      driverId: req.user!.userId,
    })
    res.json(order)
  } catch (err: any) {
    if (err?.message?.includes('Transición inválida')) {
      res.status(409).json({ error: err.message })
      return
    }
    throw err
  }
}

export async function arrived(req: Request, res: Response): Promise<void> {
  const order = await transitionOrder(String(req.params.id), 'DRIVER_ARRIVING', req.user!.userId)
  res.json(order)
}

export async function startService(req: Request, res: Response): Promise<void> {
  const order = await transitionOrder(String(req.params.id), 'IN_SERVICE', req.user!.userId)
  res.json(order)
}

export async function complete(req: Request, res: Response): Promise<void> {
  const order = await transitionOrder(String(req.params.id), 'COMPLETED', req.user!.userId)
  res.json(order)
}

export async function cancel(req: Request, res: Response): Promise<void> {
  const order = await transitionOrder(String(req.params.id), 'CANCELLED', req.user!.userId)
  res.json(order)
}

export async function history(req: Request, res: Response): Promise<void> {
  const role = req.user!.role === 'DRIVER' ? 'DRIVER' : 'CLIENT'
  const orders = await getUserOrderHistory(req.user!.userId, role)
  res.json(orders)
}
