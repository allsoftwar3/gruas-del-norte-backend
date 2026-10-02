// Mock centralizado de Prisma — todos los métodos son jest.fn() por defecto
const prisma = {
  user: {
    findFirst:         jest.fn(),
    findUnique:        jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany:          jest.fn(),
    create:            jest.fn(),
    update:            jest.fn(),
    updateMany:        jest.fn(),
    count:             jest.fn(),
  },
  order: {
    findUnique:        jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany:          jest.fn(),
    create:            jest.fn(),
    update:            jest.fn(),
    count:             jest.fn(),
    aggregate:         jest.fn(),
  },
  tariff: {
    findFirst:         jest.fn(),
    findUniqueOrThrow: jest.fn(),
    findMany:          jest.fn(),
    upsert:            jest.fn(),
  },
  driverStatus: {
    create:  jest.fn(),
    upsert:  jest.fn(),
    count:   jest.fn(),
  },
  vehicle: {
    findUnique:  jest.fn(),
    upsert:      jest.fn(),
    updateMany:  jest.fn(),
  },
  locationHistory: {
    create: jest.fn(),
  },
  rating: {
    create:      jest.fn(),
    findUnique:  jest.fn(),
  },
}

export default prisma
