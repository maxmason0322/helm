import { Router } from 'express';
import { eq, isNull, desc, and, gte, lte, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { transactions, accounts } from '../db/schema.js';
import { syncAllTransactions } from '../services/sync.service.js';
import { logActivity } from '../services/activity.js';

export const transactionsRouter = Router();

function escapeLike(input: string): string {
  return input.replace(/%/g, '\\%').replace(/_/g, '\\_');
}

// GET /api/transactions
transactionsRouter.get('/', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const { accountId, startDate, endDate, search, limit, offset } = req.query;

    const conditions = [
      isNull(transactions.deletedAt),
      isNull(accounts.deletedAt),
    ];

    if (accountId) {
      const id = Number(accountId);
      if (Number.isNaN(id)) { res.status(400).json({ error: 'Invalid accountId' }); return; }
      conditions.push(eq(transactions.accountId, id));
    }
    if (startDate && typeof startDate === 'string') {
      const d = new Date(startDate);
      if (Number.isNaN(d.getTime())) { res.status(400).json({ error: 'Invalid startDate' }); return; }
      conditions.push(gte(transactions.date, d));
    }
    if (endDate && typeof endDate === 'string') {
      const d = new Date(endDate);
      if (Number.isNaN(d.getTime())) { res.status(400).json({ error: 'Invalid endDate' }); return; }
      conditions.push(lte(transactions.date, d));
    }
    if (search && typeof search === 'string') {
      const pattern = `%${escapeLike(search)}%`;
      conditions.push(
        or(
          ilike(transactions.merchant, pattern),
          ilike(transactions.name, pattern),
        )!,
      );
    }

    const pageLimit = Math.min(Math.max(1, Math.floor(Number(limit) || 50)), 200);
    const pageOffset = Math.max(0, Math.floor(Number(offset) || 0));

    const rows = await db
      .select({
        id: transactions.id,
        accountId: transactions.accountId,
        date: transactions.date,
        amount: transactions.amount,
        merchant: transactions.merchant,
        name: transactions.name,
        category: transactions.category,
        pending: transactions.pending,
        accountName: accounts.name,
        institution: accounts.institution,
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions))
      .orderBy(desc(transactions.date))
      .limit(pageLimit)
      .offset(pageOffset);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(and(...conditions));

    res.json({ transactions: rows, total: count });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch transactions:', message);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// POST /api/transactions/sync — manual sync
transactionsRouter.post('/sync', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const result = await syncAllTransactions();

    await logActivity(req.user.id, 'transactions_synced', {
      items_synced: result.itemsSynced,
      items_failed: result.itemsFailed,
      transactions_added: result.totals.added,
      transactions_modified: result.totals.modified,
      transactions_removed: result.totals.removed,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to sync transactions:', message);
    res.status(500).json({ error: 'Failed to sync transactions' });
  }
});
