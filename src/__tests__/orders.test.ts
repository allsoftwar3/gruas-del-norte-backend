import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app'
import prisma from '../utils/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

function makeToken(role = 'CLIENT', userId = 'u1') {
  return jwt.sign({ userId, role }, process.env.JWT_SECRET!)
}

const ORDER_STUB = {
  id: 'ord1', clientId: 'u1', driverId: null,
  status: 'SEARCHING', vehicleType: 'SIMPLE',
  originLat: 25.6866, originLng: -100.3161, originAddress: 'Monterrey Centro',
  destLat: 25.7000, destLng: -100.3300, destAddress: 'San Pedro',
  distanceKm: 2.1, basePrice: 300, kmPrice: 18, totalPrice: 337.8,
  paymentStatus: 'PENDING', stripeClientSecret: null,
  client: { id: 'u1', name: 'Juan' },
  driver: null,
}

beforeEach(() => jest.clearAllMocks())

describe('POST /api/orders', () => {
  it('requiere autenticación', async () => {
    const res = await request(app).post('/api/orders').send({})
    expect(res.status).toBe(401)
  })

  it('crea una orden y la devuelve', async () => {
    db.order.create.mockResolvedValue(ORDER_STUB as any)
    db.user.findMany.mockResolvedValue([])  // sin drivers disponibles

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${makeToken()}`)
      .send({
        vehicleType:   'SIMPLE',
        originLat:     25.6866, originLng: -100.3161, originAddress: 'Monterrey Centro',
        destLat:       25.7000, destLng:   -100.3300, destAddress:   'San Pedro',
        distanceKm:    2.1,
        basePrice:     300,
        kmPrice:       18,
        totalPrice:    337.8,
      })

    expect(res.status).toBe(201)
    expect(res.body.id).toBe('ord1')
    expect(res.body.status).toBe('SEARCHING')
  })
})

describe('GET /api/orders/:id', () => {
  it('requiere autenticación', async () => {
    const res = await request(app).get('/api/orders/ord1')
    expect(res.status).toBe(401)
  })

  it('devuelve la orden si existe', async () => {
    db.order.findUniqueOrThrow.mockResolvedValue(ORDER_STUB as any)

    const res = await request(app)
      .get('/api/orders/ord1')
      .set('Authorization', `Bearer ${makeToken()}`)

    expect(res.status).toBe(200)
    expect(res.body.id).toBe('ord1')
  })

  it('devuelve 404 si la orden no existe', async () => {
    db.order.findUniqueOrThrow.mockRejectedValue(
      Object.assign(new Error('not found'), { code: 'P2025' }),
    )

    const res = await request(app)
      .get('/api/orders/noexiste')
      .set('Authorization', `Bearer ${makeToken()}`)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/orders/:id/accept — solo DRIVER', () => {
  it('devuelve 403 si el rol es CLIENT', async () => {
    const res = await request(app)
      .put('/api/orders/ord1/accept')
      .set('Authorization', `Bearer ${makeToken('CLIENT')}`)

    expect(res.status).toBe(403)
  })

  it('acepta la orden y cambia estado a ACCEPTED', async () => {
    db.order.findUniqueOrThrow.mockResolvedValue({ ...ORDER_STUB, status: 'SEARCHING' } as any)
    db.order.update.mockResolvedValue({ ...ORDER_STUB, status: 'ACCEPTED', driverId: 'd1' } as any)

    const res = await request(app)
      .put('/api/orders/ord1/accept')
      .set('Authorization', `Bearer ${makeToken('DRIVER', 'd1')}`)

    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ACCEPTED')
  })

  it('devuelve 409 si la orden ya fue aceptada por otro', async () => {
    db.order.findUniqueOrThrow.mockResolvedValue({ ...ORDER_STUB, status: 'ACCEPTED', driverId: 'd2' } as any)

    const res = await request(app)
      .put('/api/orders/ord1/accept')
      .set('Authorization', `Bearer ${makeToken('DRIVER', 'd1')}`)

    expect(res.status).toBe(409)
  })
})
