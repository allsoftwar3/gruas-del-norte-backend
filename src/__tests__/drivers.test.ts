import request from 'supertest'
import app from '../app'
import prisma from '../utils/prisma'
import jwt from 'jsonwebtoken'

jest.mock('../utils/prisma')
jest.mock('../utils/redis', () => ({
  __esModule: true,
  default: {
    set:     () => Promise.resolve('OK'),
    del:     () => Promise.resolve(1),
    get:     () => Promise.resolve(null),
    on:      () => {},
    connect: () => Promise.resolve(),
  },
}))

const JWT_SECRET = process.env.JWT_SECRET!

function makeToken(userId: string, role: 'DRIVER' | 'CLIENT' | 'ADMIN') {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '1h' })
}

const driverToken = makeToken('driver-1', 'DRIVER')
const clientToken = makeToken('client-1', 'CLIENT')

const db = prisma as any

beforeEach(() => jest.clearAllMocks())

// ─── POST /drivers/vehicle ─────────────────────────────────────────────────

describe('POST /drivers/vehicle', () => {
  const vehiclePayload = {
    type:   'SIMPLE',
    brand:  'Chevrolet',
    model:  'Silverado',
    year:   2020,
    plates: 'ABC-123',
  }

  test('registra vehículo correctamente', async () => {
    db.vehicle.upsert.mockResolvedValue({ id: 'v-1', driverId: 'driver-1', verified: false, ...vehiclePayload })

    const res = await request(app)
      .post('/api/drivers/vehicle')
      .set('Authorization', `Bearer ${driverToken}`)
      .send(vehiclePayload)

    expect(res.status).toBe(200)
    expect(res.body.verified).toBe(false)
    expect(db.vehicle.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { driverId: 'driver-1' },
      })
    )
  })

  test('400 con tipo de vehículo inválido', async () => {
    const res = await request(app)
      .post('/api/drivers/vehicle')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ ...vehiclePayload, type: 'INVALID' })

    expect(res.status).toBe(400)
  })

  test('400 sin plates', async () => {
    const res = await request(app)
      .post('/api/drivers/vehicle')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ ...vehiclePayload, plates: '' })

    expect(res.status).toBe(400)
  })

  test('403 para CLIENT', async () => {
    const res = await request(app)
      .post('/api/drivers/vehicle')
      .set('Authorization', `Bearer ${clientToken}`)
      .send(vehiclePayload)

    expect(res.status).toBe(403)
  })
})

// ─── GET /drivers/vehicle ──────────────────────────────────────────────────

describe('GET /drivers/vehicle', () => {
  test('devuelve vehículo registrado', async () => {
    db.vehicle.findUnique.mockResolvedValue({
      id: 'v-1', driverId: 'driver-1', type: 'SIMPLE',
      brand: 'Chevrolet', model: 'Silverado', year: 2020, plates: 'ABC-123', verified: false,
    })

    const res = await request(app)
      .get('/api/drivers/vehicle')
      .set('Authorization', `Bearer ${driverToken}`)

    expect(res.status).toBe(200)
    expect(res.body.plates).toBe('ABC-123')
  })

  test('404 cuando no hay vehículo', async () => {
    db.vehicle.findUnique.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/drivers/vehicle')
      .set('Authorization', `Bearer ${driverToken}`)

    expect(res.status).toBe(404)
  })

  test('401 sin token', async () => {
    const res = await request(app).get('/api/drivers/vehicle')
    expect(res.status).toBe(401)
  })
})

// ─── GET /drivers/stats ────────────────────────────────────────────────────

describe('GET /drivers/stats', () => {
  test('devuelve estadísticas del día', async () => {
    db.order.count.mockResolvedValue(3)
    db.order.aggregate.mockResolvedValue({ _sum: { totalPrice: 1500 } })

    const res = await request(app)
      .get('/api/drivers/stats')
      .set('Authorization', `Bearer ${driverToken}`)

    expect(res.status).toBe(200)
    expect(res.body.todayOrders).toBe(3)
    expect(res.body.dailyEarnings).toBe(1500)
  })

  test('devuelve 0 si no hay órdenes hoy', async () => {
    db.order.count.mockResolvedValue(0)
    db.order.aggregate.mockResolvedValue({ _sum: { totalPrice: null } })

    const res = await request(app)
      .get('/api/drivers/stats')
      .set('Authorization', `Bearer ${driverToken}`)

    expect(res.status).toBe(200)
    expect(res.body.todayOrders).toBe(0)
    expect(res.body.dailyEarnings).toBe(0)
  })

  test('403 para CLIENT', async () => {
    const res = await request(app)
      .get('/api/drivers/stats')
      .set('Authorization', `Bearer ${clientToken}`)

    expect(res.status).toBe(403)
  })
})

// ─── PUT /drivers/availability ─────────────────────────────────────────────

describe('PUT /drivers/availability', () => {
  test('activa disponibilidad', async () => {
    db.driverStatus.upsert.mockResolvedValue({ driverId: 'driver-1', available: true })

    const res = await request(app)
      .put('/api/drivers/availability')
      .set('Authorization', `Bearer ${driverToken}`)
      .send({ available: true })

    expect(res.status).toBe(200)
    expect(res.body.available).toBe(true)
  })
})
