import admin from 'firebase-admin'
import prisma from '../utils/prisma'

export async function sendPushToUser(
  userId: string,
  notification: { title: string; body: string },
  data?: Record<string, string>,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where:  { id: userId },
    select: { fcmToken: true },
  })
  if (!user?.fcmToken) return

  try {
    await admin.messaging().send({
      token: user.fcmToken,
      notification,
      data,
      android: {
        priority: 'high',
        notification: { channelId: 'gruas_canal', sound: 'default' },
      },
    })
  } catch (err) {
    // Token inválido o expirado — limpiar para no reintentar
    const code = (err as any)?.errorInfo?.code
    if (code === 'messaging/registration-token-not-registered' ||
        code === 'messaging/invalid-registration-token') {
      await prisma.user.update({ where: { id: userId }, data: { fcmToken: null } }).catch(() => {})
    }
  }
}
