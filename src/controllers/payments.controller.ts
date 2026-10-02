import { Request, Response } from 'express'
import { z } from 'zod'
import { createPaymentIntent, handleWebhook, refundOrder } from '../services/stripe.service'

export async function createIntent(req: Request, res: Response): Promise<void> {
  const { orderId } = z.object({ orderId: z.string() }).parse(req.body)
  const result = await createPaymentIntent(orderId)
  res.json(result)
}

export async function webhook(req: Request, res: Response): Promise<void> {
  const signature = req.headers['stripe-signature'] as string
  if (!signature) {
    res.status(400).json({ error: 'Firma de Stripe requerida' })
    return
  }
  const event = await handleWebhook(req.body as Buffer, signature)
  res.json({ received: true, type: event.type })
}

export async function refund(req: Request, res: Response): Promise<void> {
  const { orderId } = z.object({ orderId: z.string() }).parse(req.body)
  const result = await refundOrder(orderId)
  res.json(result)
}
