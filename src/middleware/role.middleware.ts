import { Request, Response, NextFunction } from 'express'

export function requireRole(...roles: Array<'CLIENT' | 'DRIVER' | 'ADMIN'>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Acceso denegado' })
      return
    }
    next()
  }
}
