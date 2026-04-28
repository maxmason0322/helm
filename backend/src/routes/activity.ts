import { Router } from 'express';

export const activityRouter = Router();

// GET /api/activity
activityRouter.get('/', async (_req, res) => {
  res.status(501).json({ error: 'Not implemented' });
});
