import Stripe from 'stripe'
import prisma from '../utils/prisma'

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key || key.startsWith('sk_test_...')) {
    throw new Error('STRIPE_SECRET_KEY no configurada')
  }
  return new Stripe(key, { apiVersion: '2025-02-24.acacia' })
}

export async function createPaymentIntent(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })

  if (order.stripePaymentIntentId) {
    const intent = await getStripe().paymentIntents.retrieve(order.stripePaymentIntentId)
    return { clientSecret: intent.client_secret!, paymentIntentId: intent.id }
  }

  const amountCentavos = Math.round(order.totalPrice * 100)

  const intent = await getStripe().paymentIntents.create({
    amount:   amountCentavos,
    currency: process.env.STRIPE_CURRENCY ?? 'mxn',
    metadata: { orderId },
  })

  await prisma.order.update({
    where: { id: orderId },
    data:  {
      stripePaymentIntentId: intent.id,
      stripeClientSecret:    intent.client_secret!,
    },
  })

  return { clientSecret: intent.client_secret!, paymentIntentId: intent.id }
}

export async function handleWebhook(payload: Buffer, signature: string) {
  const event = getStripe().webhooks.constructEvent(
    payload,
    signature,
    process.env.STRIPE_WEBHOOK_SECRET!,
  )

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent
    const orderId = intent.metadata.orderId

    await prisma.order.update({
      where: { id: orderId },
      data:  { paymentStatus: 'PAID' },
    })
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent
    const orderId = intent.metadata.orderId

    await prisma.order.update({
      where: { id: orderId },
      data:  { paymentStatus: 'FAILED' },
    })
  }

  return event
}

export async function refundOrder(orderId: string) {
  const order = await prisma.order.findUniqueOrThrow({ where: { id: orderId } })

  if (!order.stripePaymentIntentId || order.paymentStatus !== 'PAID') {
    throw new Error('No hay pago completado para reembolsar')
  }

  const refund = await getStripe().refunds.create({
    payment_intent: order.stripePaymentIntentId,
  })

  await prisma.order.update({
    where: { id: orderId },
    data:  { paymentStatus: 'REFUNDED' },
  })

  return refund
}
