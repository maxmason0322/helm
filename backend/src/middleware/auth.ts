import type { Request, Response, NextFunction } from 'express';

// Neon Auth (Better Auth) middleware
// Verifies session tokens and attaches user to request

export async function requireAuth(_req: Request, res: Response, next: NextFunction) {
  // TODO: Implement Better Auth session verification
  next();
}
