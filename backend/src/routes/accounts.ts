import { Router } from 'express';
import { eq, isNull, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts } from '../db/schema.js';
import { syncAllAccounts } from '../services/account-sync.js';
import { logActivity } from '../services/activity.js';

export const accountsRouter = Router();

// GET /api/accounts
accountsRouter.get('/', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const includeHidden = req.query.includeHidden === 'true';
    const conditions = [isNull(accounts.deletedAt)];
    if (!includeHidden) {
      conditions.push(isNull(accounts.hiddenAt));
    }

    const allAccounts = await db
      .select()
      .from(accounts)
      .where(and(...conditions))
      .orderBy(accounts.institution, accounts.name);

    res.json(allAccounts);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch accounts:', message);
    res.status(500).json({ error: 'Failed to fetch accounts' });
  }
});

// POST /api/accounts/sync — manual refresh all account balances
accountsRouter.post('/sync', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    await syncAllAccounts();
    await logActivity(req.user.id, 'accounts_synced', {});

    const allAccounts = await db
      .select()
      .from(accounts)
      .where(and(isNull(accounts.deletedAt), isNull(accounts.hiddenAt)))
      .orderBy(accounts.institution, accounts.name);

    res.json(allAccounts);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to sync accounts:', message);
    res.status(500).json({ error: 'Failed to sync accounts' });
  }
});

// PATCH /api/accounts/:id/hide
accountsRouter.patch('/:id/hide', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: 'Invalid account ID' }); return; }

  try {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!account || account.deletedAt) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    await db.update(accounts).set({ hiddenAt: new Date() }).where(eq(accounts.id, id));
    await logActivity(req.user.id, 'account_hidden', {
      account_name: account.name,
      institution: account.institution,
    });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to hide account:', message);
    res.status(500).json({ error: 'Failed to hide account' });
  }
});

// PATCH /api/accounts/:id/unhide
accountsRouter.patch('/:id/unhide', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const id = Number(req.params.id);
  if (Number.isNaN(id)) { res.status(400).json({ error: 'Invalid account ID' }); return; }

  try {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    if (!account || account.deletedAt) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    await db.update(accounts).set({ hiddenAt: null }).where(eq(accounts.id, id));
    await logActivity(req.user.id, 'account_unhidden', {
      account_name: account.name,
      institution: account.institution,
    });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to unhide account:', message);
    res.status(500).json({ error: 'Failed to unhide account' });
  }
});

// GET /api/accounts/:id
accountsRouter.get('/:id', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: 'Invalid account ID' });
    return;
  }

  try {
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id));

    if (!account || account.deletedAt) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    res.json(account);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to fetch account:', message);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});
