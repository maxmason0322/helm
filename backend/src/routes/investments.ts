import { Router } from 'express';
import { eq, isNull, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { holdings, investmentTransactions, accounts } from '../db/schema.js';
import { syncAllInvestments } from '../services/investment-sync.js';
import { logActivity } from '../services/activity.js';

export const investmentsRouter = Router();

// GET /api/investments/holdings
investmentsRouter.get('/holdings', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const rows = await db
      .select({
        id: holdings.id,
        accountId: holdings.accountId,
        ticker: holdings.ticker,
        name: holdings.name,
        quantity: holdings.quantity,
        costBasis: holdings.costBasis,
        marketValue: holdings.marketValue,
        currency: holdings.currency,
        updatedAt: holdings.updatedAt,
        accountName: accounts.name,
        institution: accounts.institution,
      })
      .from(holdings)
      .innerJoin(accounts, eq(holdings.accountId, accounts.id))
      .where(and(isNull(holdings.deletedAt), isNull(accounts.deletedAt)))
      .orderBy(holdings.ticker);

    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch holdings:', message);
    res.status(500).json({ error: 'Failed to fetch holdings' });
  }
});

// GET /api/investments/transactions
investmentsRouter.get('/transactions', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const rows = await db
      .select({
        id: investmentTransactions.id,
        accountId: investmentTransactions.accountId,
        date: investmentTransactions.date,
        type: investmentTransactions.type,
        ticker: investmentTransactions.ticker,
        amount: investmentTransactions.amount,
        quantity: investmentTransactions.quantity,
        price: investmentTransactions.price,
        accountName: accounts.name,
        institution: accounts.institution,
      })
      .from(investmentTransactions)
      .innerJoin(accounts, eq(investmentTransactions.accountId, accounts.id))
      .where(and(isNull(investmentTransactions.deletedAt), isNull(accounts.deletedAt)))
      .orderBy(desc(investmentTransactions.date));

    res.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch investment transactions:', message);
    res.status(500).json({ error: 'Failed to fetch investment transactions' });
  }
});

// POST /api/investments/sync
investmentsRouter.post('/sync', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const result = await syncAllInvestments();
    await logActivity(req.user.id, 'investments_synced', {
      items_synced: result.itemsSynced,
      items_failed: result.itemsFailed,
      holdings_synced: result.holdingsSynced,
      transactions_synced: result.transactionsSynced,
    });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to sync investments:', message);
    res.status(500).json({ error: 'Failed to sync investments' });
  }
});
