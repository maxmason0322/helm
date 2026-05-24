import { Router } from 'express';
import { isNull, sql, and, gte, desc } from 'drizzle-orm';

import { db } from '../db/index.js';
import { accounts, transactions } from '../db/schema.js';

export const dashboardRouter = Router();

const LIABILITY_TYPES = ['credit', 'loan'];

// GET /api/dashboard
dashboardRouter.get('/', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run all three queries in parallel
    const [allAccounts, spendingRows, recentTransactions] = await Promise.all([
      db
        .select({
          id: accounts.id,
          institution: accounts.institution,
          name: accounts.name,
          type: accounts.type,
          subtype: accounts.subtype,
          mask: accounts.mask,
          currentBalance: accounts.currentBalance,
          currency: accounts.currency,
        })
        .from(accounts)
        .where(and(isNull(accounts.deletedAt), isNull(accounts.hiddenAt)))
        .orderBy(accounts.institution, accounts.name),

      db
        .select({
          category: transactions.category,
          total: sql<string>`sum(${transactions.amount})::text`,
        })
        .from(transactions)
        .where(
          and(
            isNull(transactions.deletedAt),
            gte(transactions.date, thirtyDaysAgo),
            sql`${transactions.amount} > 0`,
          ),
        )
        .groupBy(transactions.category)
        .orderBy(desc(sql`sum(${transactions.amount})`))
        .limit(10),

      db
        .select({
          id: transactions.id,
          date: transactions.date,
          amount: transactions.amount,
          merchant: transactions.merchant,
          name: transactions.name,
          category: transactions.category,
          pending: transactions.pending,
        })
        .from(transactions)
        .where(isNull(transactions.deletedAt))
        .orderBy(desc(transactions.date))
        .limit(5),
    ]);

    // Net worth: assets positive, liabilities negative
    let netWorth = 0;
    const balanceByType: Record<string, number> = {};

    for (const acct of allAccounts) {
      const balance = parseFloat(acct.currentBalance ?? '0') || 0;
      const type = acct.type;
      const value = LIABILITY_TYPES.includes(type) ? -balance : balance;
      netWorth += value;
      balanceByType[type] = (balanceByType[type] || 0) + value;
    }

    const spendingByCategory = spendingRows.map(r => ({
      category: r.category?.toLowerCase().replace(/_/g, ' ') || 'uncategorized',
      amount: parseFloat(r.total) || 0,
    }));

    res.json({
      netWorth,
      balanceByType,
      accounts: allAccounts,
      spendingByCategory,
      recentTransactions,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch dashboard data:', message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});
