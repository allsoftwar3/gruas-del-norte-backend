import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app'
import prisma from '../utils/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

function makeToken(role: string) {
  return jwt.sign({ userId: 'u1', role }, process.env.JWT_SECRET!)
}

beforeEach(() => jest.clearAllMocks())

describe('GET /api/admin/stats — solo ADMIN', () => {
  it('devuelve 403 a un DRIVER', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${makeToken('DRIVER')}`)
    expect(res.status).toBe(403)
  })

  it('devuelve 403 a un CLIENT', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${makeToken('CLIENT')}`)
    expect(res.status).toBe(403)
  })

  it('devuelve estadísticas del día al ADMIN', async () => {
    db.order.count.mockResolvedValue(5)
    db.order.aggregate.mockResolvedValue({ _sum: { totalPrice: 2500 } } as any)
    db.driverStatus.count.mockResolvedValue(3)

    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${makeToken('ADMIN')}`)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({
      ordenesHoy:      5,
      ingresosTotales: 2500,
      driversActivos:  3,
    })
  })
})

describe('PUT /api/admin/tariffs — solo ADMIN', () => {
  it('actualiza una tarifa', async () => {
    db.tariff.upsert.mockResolvedValue({
      id: 't1', vehicleType: 'SIMPLE', basePrice: 350, pricePerKm: 20,
    } as any)

    const res = await request(app)
      .put('/api/admin/tariffs')
      .set('Authorization', `Bearer ${makeToken('ADMIN')}`)
      .send({ vehicleType: 'SIMPLE', basePrice: 350, pricePerKm: 20 })

    expect(res.status).toBe(200)
    expect(res.body.basePrice).toBe(350)
  })

  it('devuelve 400 con precio negativo', async () => {
    const res = await request(app)
      .put('/api/admin/tariffs')
      .set('Authorization', `Bearer ${makeToken('ADMIN')}`)
      .send({ vehicleType: 'SIMPLE', basePrice: -100, pricePerKm: 20 })

    expect(res.status).toBe(400)
  })
})

describe('PUT /api/admin/drivers/:id/approve — solo ADMIN', () => {
  it('activa al driver y verifica su vehículo', async () => {
    db.user.update.mockResolvedValue({ id: 'd1', name: 'Pedro', active: true } as any)
    db.vehicle.updateMany.mockResolvedValue({ count: 1 } as any)

    const res = await request(app)
      .put('/api/admin/drivers/d1/approve')
      .set('Authorization', `Bearer ${makeToken('ADMIN')}`)

    expect(res.status).toBe(200)
    expect(res.body.active).toBe(true)
    expect(db.vehicle.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { verified: true } }),
    )
  })
})
