import { VehicleType } from '@prisma/client'
import prisma from '../utils/prisma'
import { getDirections } from './maps.service'

interface QuoteInput {
  originLat: number
  originLng: number
  destLat: number
  destLng: number
  vehicleType: VehicleType
}

export interface QuoteResult {
  distanceKm: number
  basePrice: number
  kmPrice: number
  total: number
  etaMin: number
}

export async function calculateQuote(input: QuoteInput): Promise<QuoteResult> {
  const tariff = await prisma.tariff.findUniqueOrThrow({
    where: { vehicleType: input.vehicleType },
  })

  const { distanceKm, durationMin } = await getDirections(
    input.originLat, input.originLng,
    input.destLat,   input.destLng,
  )

  const total = tariff.basePrice + tariff.pricePerKm * distanceKm

  // ETA de llegada del grúero estimada (10-20 min sobre el tiempo real)
  const etaMin = durationMin + Math.floor(Math.random() * 11) + 10

  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    basePrice:  tariff.basePrice,
    kmPrice:    tariff.pricePerKm,
    total:      Math.round(total * 100) / 100,
    etaMin,
  }
}
