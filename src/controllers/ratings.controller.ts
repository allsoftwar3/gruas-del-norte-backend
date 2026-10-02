import { Request, Response } from 'express'
import { z } from 'zod'
import prisma from '../utils/prisma'

const RatingSchema = z.object({
  orderId:   z.string(),
  toUserId:  z.string(),
  stars:     z.number().int().min(1).max(5),
  comment:   z.string().max(500).optional(),
})

export async function createRating(req: Request, res: Response): Promise<void> {
  const parsed = RatingSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }

  const { orderId, toUserId, stars, comment } = parsed.data

  // Verificar que la orden está completada y pertenece al usuario
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })
  if (order.status !== 'COMPLETED') {
    res.status(400).json({ error: 'Solo se puede calificar órdenes completadas' })
    return
  }

  const rating = await prisma.rating.create({
    data: { orderId, fromUserId: req.user!.userId, toUserId, stars, comment },
  })

  res.status(201).json(rating)
}
