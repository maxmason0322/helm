import { Router } from 'express';
import { CountryCode, Products } from 'plaid';
import { plaidClient } from '../services/plaid.service.js';
import { encrypt } from '../services/encryption.js';
import { logActivity } from '../services/activity.js';
import { syncAccounts } from '../services/account-sync.js';
import { db } from '../db/index.js';
import { plaidItems } from '../db/schema.js';

export const plaidRouter = Router();

// POST /api/plaid/create-link-token
plaidRouter.post('/create-link-token', async (req, res) => {
  if (!req.user) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: req.user.id },
      client_name: 'Helm',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });

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
        });
      }

      return inserted;
    });

    if (!result) {
      res.status(409).json({ error: 'Account already linked' });
      return;
    }

    // Sync accounts from Plaid immediately after linking
    try {
      await syncAccounts(result.id);
    } catch (syncErr) {
      const syncMsg = syncErr instanceof Error ? syncErr.message : 'Unknown error';
      console.error('Initial account sync failed:', syncMsg);
      // Non-fatal — item is linked, sync can be retried
    }

    res.json({ id: result.id });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to exchange token:', message);
    res.status(500).json({ error: 'Failed to link account' });
  }
});

// Webhook route — mounted separately in index.ts (outside requireAuth)
