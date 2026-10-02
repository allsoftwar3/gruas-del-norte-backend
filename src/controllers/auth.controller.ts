import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import prisma from '../utils/prisma'

const RegisterSchema = z.object({
  name:     z.string().min(2),
  email:    z.string().email().optional(),
  phone:    z.string().min(10).optional(),
  password: z.string().min(6),
  role:     z.enum(['CLIENT', 'DRIVER']).default('CLIENT'),
}).refine((d) => d.email || d.phone, {
  message: 'Se requiere email o teléfono',
})

const LoginSchema = z.object({
  email:    z.string().email().optional(),
  phone:    z.string().optional(),
  password: z.string(),
}).refine((d) => d.email || d.phone, {
  message: 'Se requiere email o teléfono',
})

function signToken(userId: string, role: string) {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' } as jwt.SignOptions,
  )
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = RegisterSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }

  const { name, email, phone, password, role } = parsed.data

  // Verificar duplicados
  const exists = await prisma.user.findFirst({
    where: { OR: [email ? { email } : {}, phone ? { phone } : {}] },
  })
  if (exists) {
    res.status(409).json({ error: 'El usuario ya existe' })
    return
  }

  const passwordHash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({
    data: { name, email, phone, passwordHash, role },
    select: { id: true, name: true, email: true, phone: true, role: true },
  })

  // Crear estado de driver si aplica
  if (role === 'DRIVER') {
    await prisma.driverStatus.create({ data: { driverId: user.id } })
  }

  const token = signToken(user.id, user.role)
  res.status(201).json({ user, token })
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = LoginSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors })
    return
  }

  const { email, phone, password } = parsed.data

  const user = await prisma.user.findFirst({
    where: email ? { email } : { phone },
  })

  if (!user || !user.active) {
    res.status(401).json({ error: 'Credenciales inválidas' })
    return
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    res.status(401).json({ error: 'Credenciales inválidas' })
    return
  }

  const token = signToken(user.id, user.role)
  res.json({
    user: {
      id: user.id, name: user.name, email: user.email,
      phone: user.phone, role: user.role, profilePic: user.profilePic,
    },
    token,
  })
}

export async function updateFcmToken(req: Request, res: Response): Promise<void> {
  const { token } = req.body as { token?: string }
  if (!token || typeof token !== 'string') {
    res.status(400).json({ error: 'token requerido' })
    return
  }
  await prisma.user.update({
    where: { id: req.user!.userId },
    data:  { fcmToken: token },
  })
  res.json({ ok: true })
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.userId },
    select: {
      id: true, name: true, email: true, phone: true,
      role: true, profilePic: true, active: true,
      vehicle: true, driverStatus: true,
    },
  })
  res.json(user)
}
