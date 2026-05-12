import { Request, Response } from 'express'
import { userRepo } from '../repositories/user.repo.js'
import { UnauthorizedError } from '../utils/errors.js'

export const userController = {
  /**
   * GET /api/users/search?q=...
   *
   * Authenticated lookup used by the editors-invite UI. Returns at most
   * 10 active users whose displayName or email starts with `q`. The
   * caller is excluded from the results.
   */
  async search(req: Request, res: Response) {
    const userId = (req as any).userId
    if (!userId) throw new UnauthorizedError('Authentication required')

    const q = typeof req.query.q === 'string' ? req.query.q : ''
    if (q.trim().length < 2) {
      res.json({ data: [] })
      return
    }
    const users = await userRepo.search(q, userId, 10)
    res.json({ data: users })
  }
}
