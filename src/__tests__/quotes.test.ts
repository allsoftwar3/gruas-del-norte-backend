import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app'
import prisma from '../utils/prisma'

jest.mock('../services/maps.service', () => ({
  getDirections: jest.fn().mockResolvedValue({ distanceKm: 2.5, durationMin: 8 }),
}))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

function makeToken(role = 'CLIENT') {
  return jwt.sign({ userId: 'u1', role }, process.env.JWT_SECRET!)
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/quotes', () => {
  const payload = {
    vehicleType: 'SIMPLE',
    originLat: 25.6866, originLng: -100.3161,
    originAddress: 'Monterrey Centro',
    destLat: 25.7000, destLng: -100.3300,
    destAddress: 'San Pedro',
  }

  it('requiere autenticación', async () => {
    const res = await request(app).post('/api/quotes').send(payload)
    expect(res.status).toBe(401)
  })

  it('calcula cotización con tarifa existente', async () => {
    db.tariff.findUniqueOrThrow.mockResolvedValue({
      id: 't1', vehicleType: 'SIMPLE', basePrice: 300, pricePerKm: 18,
    } as any)

    const res = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send(payload)

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('basePrice', 300)
    expect(res.body).toHaveProperty('kmPrice', 18)
    expect(res.body).toHaveProperty('total')
    expect(res.body).toHaveProperty('distanceKm')
    expect(res.body.distanceKm).toBeGreaterThan(0)
  })

  it('devuelve 404 si no hay tarifa para ese vehículo', async () => {
    db.tariff.findUniqueOrThrow.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'P2025' }),
    )

    const res = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send(payload)

    expect(res.status).toBe(404)
  })

  it('devuelve 400 si el tipo de vehículo es inválido', async () => {
    const res = await request(app)
      .post('/api/quotes')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({ ...payload, vehicleType: 'MOTO' })

    expect(res.status).toBe(400)
  })
})
