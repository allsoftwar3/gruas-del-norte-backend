import { Request, Response } from 'express'
import { z } from 'zod'
import { VehicleType } from '@prisma/client'
import { calculateQuote } from '../services/quote.service'

const QuoteSchema = z.object({
  originLat:   z.number(),
  originLng:   z.number(),
  destLat:     z.number(),
  destLng:     z.number(),
  vehicleType: z.nativeEnum(VehicleType),
})

export async function getQuote(req: Request, res: Response): Promise<void> {
  const parsed = QuoteSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }

  try {
    const result = await calculateQuote(parsed.data)
    res.json(result)
  } catch (err: any) {
    if (err?.code === 'P2025') {
      res.status(404).json({ error: 'Sin tarifa para ese tipo de vehículo' })
      return
    }
    throw err
  }
}
