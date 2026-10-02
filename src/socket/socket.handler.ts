import { Server, Socket } from 'socket.io'
import jwt from 'jsonwebtoken'
import { AuthPayload } from '../middleware/auth.middleware'
import redis from '../utils/redis'
import prisma from '../utils/prisma'
import { getDirections } from '../services/maps.service'
import { sendPushToUser } from '../services/notifications.service'

// driverId → socketId (para enviar solicitudes al driver correcto)
const driverSockets = new Map<string, string>()

function verifyToken(token: string): AuthPayload | null {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
  } catch {
    return null
  }
}

export function registerSocketHandlers(io: Server): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth.token as string
    const payload = verifyToken(token)
    if (!payload) return next(new Error('Token inválido'))

    socket.data.userId = payload.userId
    socket.data.role   = payload.role
    next()
  })

  io.on('connection', (socket: Socket) => {
    const { userId, role } = socket.data as { userId: string; role: string }

    if (role === 'DRIVER') {
      driverSockets.set(userId, socket.id)
      console.log(`Driver ${userId} conectado`)
    }

    // ─── Driver actualiza su ubicación GPS (cada ~3 seg) ───
    socket.on('driver:update_location', async (data: {
      orderId?: string
      lat: number
      lng: number
    }) => {
      const { orderId, lat, lng } = data

      // Guardar última posición en Redis (TTL 30 seg)
      await redis.set(
        `driver:location:${userId}`,
        JSON.stringify({ lat, lng, ts: Date.now() }),
        'EX', 30,
      ).catch(() => {})

      if (!orderId) return

      // Guardar en historial de BD (no-blocking)
      prisma.locationHistory.create({
        data: { orderId, driverId: userId, lat, lng },
      }).catch(() => {})

      // Actualizar posición en driverStatus
      prisma.driverStatus.upsert({
        where:  { driverId: userId },
        update: { currentLat: lat, currentLng: lng },
        create: { driverId: userId, currentLat: lat, currentLng: lng },
      }).catch(() => {})

      // Calcular ETA real con Google Directions si hay orden activa
      let etaMin = 5
      try {
        const order = await prisma.order.findUnique({
          where:  { id: orderId },
          select: { originLat: true, originLng: true, status: true },
        })
        if (order && ['ACCEPTED', 'DRIVER_ARRIVING'].includes(order.status)) {
          const { durationMin } = await getDirections(lat, lng, order.originLat, order.originLng)
          etaMin = durationMin
        }
      } catch {
        // Maps API no disponible — usar fallback 5 min
      }

      socket.to(`order:${orderId}`).emit('order:driver_location', { lat, lng, etaMin })
    })

    // ─── Driver acepta una orden ───
    socket.on('order:accept', async (data: { orderId: string }) => {
      socket.join(`order:${data.orderId}`)
      io.to(`order:${data.orderId}`).emit('order:status_changed', { status: 'ACCEPTED' })
    })

    // ─── Driver rechaza una orden ───
    socket.on('order:reject', async (data: { orderId: string }) => {
      io.to(`order:${data.orderId}`).emit('order:driver_rejected', {
        orderId: data.orderId,
      })
    })

    // ─── Cliente se une a la sala de su orden ───
    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`)
    })

    socket.on('disconnect', () => {
      if (role === 'DRIVER') {
        driverSockets.delete(userId)
        console.log(`Driver ${userId} desconectado`)
      }
    })
  })
}

// Enviar solicitud de nueva orden a un driver específico
// Si el driver está conectado por socket → socket; si no → FCM push
export function sendOrderRequest(
  io: Server,
  driverId: string,
  payload: {
    orderId: string
    clientName: string
    originAddress: string
    destAddress: string
    distanceKm: number
    vehicleType: string
    totalPrice: number
  },
): boolean {
  const socketId = driverSockets.get(driverId)

  if (socketId) {
    io.to(socketId).emit('order:new_request', payload)
    return true
  }

  // Fallback: notificación push para drivers offline
  sendPushToUser(driverId, {
    title: '¡Nueva solicitud de grúa!',
    body:  `${payload.clientName} necesita servicio — $${payload.totalPrice.toFixed(0)}`,
  }, {
    type:         'new_order_request',
    orderId:      payload.orderId,
    vehicleType:  payload.vehicleType,
    originAddress: payload.originAddress,
    destAddress:   payload.destAddress,
    totalPrice:    String(payload.totalPrice),
  }).catch(() => {})

  return false  // false = enviado por push, no por socket
}

export { driverSockets }
