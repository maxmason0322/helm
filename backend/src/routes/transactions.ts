import { Router } from 'express';

export const transactionsRouter = Router();

// GET /api/transactions
transactionsRouter.get('/', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});
