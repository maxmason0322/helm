import { Router } from 'express';
import { desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { activityLog } from '../db/schema.js';
import { user } from '../db/auth-schema.js';
import { eq } from 'drizzle-orm';

export const activityRouter = Router();

// GET /api/activity
activityRouter.get('/', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const limit = Math.min(Math.max(1, Math.floor(Number(req.query.limit) || 50)), 200);
    const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0));

    const rows = await db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        metadata: activityLog.metadata,
        createdAt: activityLog.createdAt,
        userName: user.name,
      })
      .from(activityLog)
      .leftJoin(user, eq(activityLog.userId, user.id))
      .orderBy(desc(activityLog.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(activityLog);

    res.json({ activities: rows, total: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch activity log:', message);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});
