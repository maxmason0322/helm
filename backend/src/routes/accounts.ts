import { Router } from 'express';

export const accountsRouter = Router();

// GET /api/accounts
accountsRouter.get('/', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// GET /api/accounts/:id
accountsRouter.get('/:id', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});
