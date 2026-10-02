import { PrismaClient, VehicleType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Tarifas iniciales
  const tarifas = [
    { vehicleType: VehicleType.SIMPLE,   basePrice: 300, pricePerKm: 18 },
    { vehicleType: VehicleType.PLATFORM, basePrice: 500, pricePerKm: 25 },
    { vehicleType: VehicleType.HEAVY,    basePrice: 900, pricePerKm: 40 },
  ]

  for (const tarifa of tarifas) {
    await prisma.tariff.upsert({
      where:  { vehicleType: tarifa.vehicleType },
      update: { basePrice: tarifa.basePrice, pricePerKm: tarifa.pricePerKm },
      create: tarifa,
    })
  }

  // Admin de prueba
  const adminHash = await bcrypt.hash('Admin123!', 10)
  await prisma.user.upsert({
    where:  { email: 'admin@gruasdelnorte.com' },
    update: {},
    create: {
      name: 'Admin Grúas del Norte',
      email: 'admin@gruasdelnorte.com',
      passwordHash: adminHash,
      role: 'ADMIN',
    },
  })

  console.log('Seed completado: tarifas y admin creados')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
