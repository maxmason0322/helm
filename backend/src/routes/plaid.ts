import { Router } from 'express';
import { CountryCode, Products } from 'plaid';
import { plaidClient } from '../services/plaid.service.js';
import { encrypt, decrypt } from '../services/encryption.js';
import { logActivity } from '../services/activity.js';
import { syncAccounts } from '../services/account-sync.js';
import { syncTransactions } from '../services/sync.service.js';
import { syncInvestments } from '../services/investment-sync.js';
import { db } from '../db/index.js';
import { plaidItems, accounts, transactions, holdings, investmentTransactions } from '../db/schema.js';
import { eq, inArray } from 'drizzle-orm';

export const plaidRouter = Router();

// POST /api/plaid/create-link-token
plaidRouter.post('/create-link-token', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const linkConfig: Parameters<typeof plaidClient.linkTokenCreate>[0] = {
      user: { client_user_id: req.user.id },
      client_name: 'Helm',
      products: [Products.Transactions],
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: 'en',
    };

    if (process.env.PLAID_WEBHOOK_URL) {
      linkConfig.webhook = process.env.PLAID_WEBHOOK_URL;
    }

    const response = await plaidClient.linkTokenCreate(linkConfig);

    res.json({ link_token: response.data.link_token });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to create link token:', message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// POST /api/plaid/exchange-token
plaidRouter.post('/exchange-token', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const { public_token, institution } = req.body;

  if (!public_token || typeof public_token !== 'string') {
    res.status(400).json({ error: 'public_token is required' });
    return;
  }

  const institutionName = typeof institution?.name === 'string' ? institution.name : null;
  const institutionId = typeof institution?.institution_id === 'string' ? institution.institution_id : null;

  try {
    const exchangeResponse = await plaidClient.itemPublicTokenExchange({
      public_token,
    });

    const accessToken = exchangeResponse.data.access_token;
    const itemId = exchangeResponse.data.item_id;
    const encryptedToken = encrypt(accessToken);

    // Atomic: store item + log activity
    const result = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(plaidItems)
        .values({
          itemId,
          accessToken: encryptedToken,
          institutionName,
          institutionId,
        })
        .onConflictDoNothing({ target: plaidItems.itemId })
        .returning({ id: plaidItems.id });

      if (inserted) {
        await logActivity(req.user!.id, 'account_linked', {
          institution_name: institutionName,
          institution_id: institutionId,
        }, tx);
      }

      return inserted;
    });

    if (!result) {
      res.status(409).json({ error: 'Account already linked' });
      return;
    }

    // Sync accounts and transactions from Plaid immediately after linking
    try {
      await syncAccounts(result.id);
      await syncTransactions(result.id);
      await syncInvestments(result.id);
    } catch (syncErr) {
      const syncMsg = syncErr instanceof Error ? syncErr.message : 'Unknown error';
      console.error('Initial sync failed:', syncMsg);
      // Non-fatal — item is linked, sync can be retried
    }

    res.json({ id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to exchange token:', message);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

// DELETE /api/plaid/items/:itemId — unlink an institution
plaidRouter.delete('/items/:itemId', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  const itemId = Number(req.params.itemId);
  if (Number.isNaN(itemId)) {
    res.status(400).json({ error: 'Invalid item ID' });
    return;
  }

  try {
    // Fetch item and revoke token before transaction (external API call)
    const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, itemId));
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }

    try {
      const accessToken = decrypt(item.accessToken);
      await plaidClient.itemRemove({ access_token: accessToken });
    } catch (revokeErr) {
      const msg = revokeErr instanceof Error ? revokeErr.message : 'Unknown error';
      console.error('Failed to revoke Plaid token (continuing with removal):', msg);
    }

    // All DB mutations inside a single transaction
    await db.transaction(async (tx) => {
      // Re-fetch accounts inside transaction for consistency
      const itemAccounts = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.plaidItemId, itemId));

      const accountIds = itemAccounts.map(a => a.id);

      if (accountIds.length > 0) {
        const now = new Date();

        await tx
          .update(transactions)
          .set({ deletedAt: now })
          .where(inArray(transactions.accountId, accountIds));

        await tx
          .update(holdings)
          .set({ deletedAt: now })
          .where(inArray(holdings.accountId, accountIds));

        await tx
          .update(investmentTransactions)
          .set({ deletedAt: now })
          .where(inArray(investmentTransactions.accountId, accountIds));

        await tx
          .update(accounts)
          .set({ deletedAt: now, plaidItemId: null })
          .where(inArray(accounts.id, accountIds));
      }

      await tx.delete(plaidItems).where(eq(plaidItems.id, itemId));

      await logActivity(req.user!.id, 'account_unlinked', {
        institution_name: item.institutionName,
        institution_id: item.institutionId,
        accounts_removed: accountIds.length,
      }, tx);
    });

    res.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to unlink account:', message);
    res.status(500).json({ error: 'Failed to unlink account' });
  }
});

// Webhook route — mounted separately in index.ts (outside requireAuth)
