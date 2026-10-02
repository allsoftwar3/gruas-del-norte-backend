import Redis from 'ioredis'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy: (times) => {
    // Reintentar máx 3 veces con backoff, luego desistir sin crashear
    if (times > 3) return null
    return Math.min(times * 200, 2000)
  },
})

redis.on('error', (err) => console.warn('[Redis] No disponible:', err.message))
redis.on('connect', () => console.log('[Redis] Conectado'))

// Conectar en background, sin bloquear el inicio
redis.connect().catch(() => {})

export default redis
