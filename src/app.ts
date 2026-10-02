import 'dotenv/config'
import express from 'express'
import http from 'http'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import { Server } from 'socket.io'
import admin from 'firebase-admin'

// Inicializar Firebase Admin SDK (opcional — el servidor arranca sin él)
if (!admin.apps.length && process.env.FIREBASE_CREDENTIALS_PATH) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const serviceAccount = require(path.resolve(process.env.FIREBASE_CREDENTIALS_PATH))
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
    console.log('Firebase Admin inicializado')
  } catch (e) {
    console.warn('Firebase Admin: no se pudo inicializar —', (e as Error).message)
  }
}

import authRoutes from './routes/auth.routes'
import quotesRoutes from './routes/quotes.routes'
import ordersRoutes from './routes/orders.routes'
import paymentsRoutes from './routes/payments.routes'
import driversRoutes from './routes/drivers.routes'
import ratingsRoutes from './routes/ratings.routes'
import adminRoutes from './routes/admin.routes'
import { registerSocketHandlers } from './socket/socket.handler'
import { errorHandler } from './middleware/error.middleware'

const app = express()
const server = http.createServer(app)

// Socket.io
export const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
})
registerSocketHandlers(io)

// Middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://unpkg.com"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://server.arcgisonline.com"],
      connectSrc: ["'self'"],
    },
  },
}))
app.use(cors())
app.use(morgan('dev'))

// El webhook de Stripe necesita el body raw
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }))
app.use(express.json())

// Rutas
app.use('/api/auth',     authRoutes)
app.use('/api/quotes',   quotesRoutes)
app.use('/api/orders',   ordersRoutes)
app.use('/api/payments', paymentsRoutes)
app.use('/api/drivers',  driversRoutes)
app.use('/api/ratings',  ratingsRoutes)
app.use('/api/admin',    adminRoutes)

app.use(express.static(path.join(__dirname, '..', 'public')))
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

app.use(errorHandler)

export { server }
export default app

// Arrancar solo cuando se ejecuta directamente (no durante tests)
if (require.main === module) {
  const PORT = process.env.PORT ?? 3000
  server.listen(PORT, () => {
    console.log(`Servidor Grúas del Norte corriendo en puerto ${PORT}`)
  })
}
