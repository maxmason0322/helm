import { Router } from 'express';
import { syncCoinbase } from '../services/coinbase-sync.js';
import { logActivity } from '../services/activity.js';

export const coinbaseRouter = Router();

// POST /api/coinbase/sync
coinbaseRouter.post('/sync', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  if (!process.env.COINBASE_API_KEY || !process.env.COINBASE_API_SECRET) {
    res.status(400).json({ error: 'Coinbase API credentials not configured' });
    return;
  }

  try {
    const result = await syncCoinbase();

    await logActivity(req.user.id, 'coinbase_synced', {
      holdings_synced: result.holdingsSynced,
      trades_synced: result.tradesSynced,
      total_value: result.totalValue,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to sync Coinbase:', message);
    res.status(500).json({ error: 'Failed to sync Coinbase' });
  }
});

// GET /api/coinbase/status — check if Coinbase is configured
coinbaseRouter.get('/status', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  res.json({
    configured: !!(process.env.COINBASE_API_KEY && process.env.COINBASE_API_SECRET),
  });
});
