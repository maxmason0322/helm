import { Router } from 'express';

export const plaidRouter = Router();

// POST /api/plaid/create-link-token
plaidRouter.post('/create-link-token', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/plaid/exchange-token
plaidRouter.post('/exchange-token', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});

// POST /api/plaid/webhook
plaidRouter.post('/webhook', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});
