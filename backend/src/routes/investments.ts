import { Router } from 'express';

export const investmentsRouter = Router();

// GET /api/investments/holdings
investmentsRouter.get('/holdings', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/investments/transactions
investmentsRouter.get('/transactions', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});
