import { OrderStatus, VehicleType } from '@prisma/client'
import prisma from '../utils/prisma'
import { io } from '../app'

// Máquina de estados válidos: estadoActual → estadosSiguientesPermitidos
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  SEARCHING:      ['ACCEPTED', 'CANCELLED'],
  ACCEPTED:       ['DRIVER_ARRIVING', 'CANCELLED'],
  DRIVER_ARRIVING: ['IN_SERVICE', 'CANCELLED'],
  IN_SERVICE:     ['COMPLETED'],
  COMPLETED:      [],
  CANCELLED:      [],
}

export async function createOrder(
  clientId: string,
  data: {
    vehicleType: VehicleType
    originLat: number
    originLng: number
    originAddress: string
    destLat: number
    destLng: number
    destAddress: string
    distanceKm: number
    basePrice: number
    kmPrice: number
    totalPrice: number
  },
) {
  return prisma.order.create({
    data: { clientId, ...data },
    include: { client: { select: { id: true, name: true, phone: true } } },
  })
}

export async function transitionOrder(
  orderId: string,
  newStatus: OrderStatus,
  actorId: string,
  extra?: { driverId?: string },
) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })

  if (!VALID_TRANSITIONS[order.status].includes(newStatus)) {
    throw new Error(
      `Transición inválida: ${order.status} → ${newStatus}`,
    )
  }

  const updateData: Parameters<typeof prisma.order.update>[0]['data'] = {
    status: newStatus,
  }
  if (newStatus === 'ACCEPTED' && extra?.driverId) {
    updateData.driverId  = extra.driverId
    updateData.acceptedAt = new Date()
  }
  if (newStatus === 'COMPLETED') {
    updateData.completedAt = new Date()
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data:  updateData,
    include: {
      driver: { select: { id: true, name: true, phone: true, profilePic: true, vehicle: true } },
      client: { select: { id: true, name: true, phone: true } },
    },
  })

  // Notificar a todos en la sala de la orden
  io.to(`order:${orderId}`).emit('order:status_changed', { status: newStatus })

  return updated
}

export async function getUserOrderHistory(userId: string, role: 'CLIENT' | 'DRIVER') {
  const where = role === 'CLIENT' ? { clientId: userId } : { driverId: userId }
  return prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      driver: { select: { id: true, name: true, profilePic: true } },
      client: { select: { id: true, name: true } },
      rating: true,
    },
  })
}
