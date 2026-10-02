import request from 'supertest'
import bcrypt from 'bcryptjs'
import app from '../app'
import prisma from '../utils/prisma'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any

beforeEach(() => jest.clearAllMocks())

describe('POST /api/auth/register', () => {
  it('registra un cliente nuevo', async () => {
    db.user.findFirst.mockResolvedValue(null)
    db.user.create.mockResolvedValue({
      id: 'u1', name: 'Juan', email: 'juan@test.com',
      phone: null, role: 'CLIENT',
    } as any)

    const res = await request(app).post('/api/auth/register').send({
      name: 'Juan', email: 'juan@test.com', password: 'secret123',
    })

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('token')
    expect(res.body.user.email).toBe('juan@test.com')
  })

  it('devuelve 400 si falta email y teléfono', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Juan', password: 'secret123',
    })
    expect(res.status).toBe(400)
  })

  it('devuelve 409 si el usuario ya existe', async () => {
    db.user.findFirst.mockResolvedValue({ id: 'u1' } as any)

    const res = await request(app).post('/api/auth/register').send({
      name: 'Juan', email: 'juan@test.com', password: 'secret123',
    })
    expect(res.status).toBe(409)
  })
})

describe('POST /api/auth/login', () => {
  it('devuelve token con credenciales correctas', async () => {
    const hash = await bcrypt.hash('secret123', 10)
    db.user.findFirst.mockResolvedValue({
      id: 'u1', name: 'Juan', email: 'juan@test.com',
      phone: null, role: 'CLIENT', active: true,
      passwordHash: hash, profilePic: null,
    } as any)

    const res = await request(app).post('/api/auth/login').send({
      email: 'juan@test.com', password: 'secret123',
    })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('token')
  })

  it('devuelve 401 con contraseña incorrecta', async () => {
    const hash = await bcrypt.hash('secret123', 10)
    db.user.findFirst.mockResolvedValue({
      id: 'u1', active: true, passwordHash: hash,
    } as any)

    const res = await request(app).post('/api/auth/login').send({
      email: 'juan@test.com', password: 'wrong',
    })
    expect(res.status).toBe(401)
  })

  it('devuelve 401 si el usuario está inactivo', async () => {
    db.user.findFirst.mockResolvedValue({
      id: 'u1', active: false, passwordHash: 'x',
    } as any)

    const res = await request(app).post('/api/auth/login').send({
      email: 'juan@test.com', password: 'secret123',
    })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('requiere token JWT', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('PUT /api/auth/fcm-token', () => {
  it('requiere autenticación', async () => {
    const res = await request(app).put('/api/auth/fcm-token').send({ token: 'abc' })
    expect(res.status).toBe(401)
  })
})
