import { Router } from 'express';
import express from 'express';
import { eq } from 'drizzle-orm';
import { verifyPlaidWebhook } from '../services/webhook-verify.js';
import { syncTransactions } from '../services/sync.service.js';
import { syncAccounts } from '../services/account-sync.js';
import { syncInvestments } from '../services/investment-sync.js';
import { logActivity } from '../services/activity.js';
import { db } from '../db/index.js';
import { plaidItems } from '../db/schema.js';

export const webhookRouter = Router();

// Use raw body parser for signature verification
webhookRouter.use(express.raw({ type: 'application/json' }));

webhookRouter.post('/', async (req, res) => {
  const rawBody = req.body as Buffer;
  const plaidVerification = req.headers['plaid-verification'] as string | undefined;

  if (!plaidVerification) {
    res.status(400).json({ error: 'Missing Plaid-Verification header' });
    return;
  }

  // Verify webhook signature (skip in sandbox for testing)
  if (process.env.PLAID_ENV !== 'sandbox') {
    try {
      const valid = await verifyPlaidWebhook(rawBody, plaidVerification);
      if (!valid) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook verification failed:', message);
      res.status(401).json({ error: 'Webhook verification failed' });
      return;
    }
  }

  // Parse the body
  let body: { webhook_type: string; webhook_code: string; item_id: string; error?: unknown };
  try {
    body = JSON.parse(rawBody.toString());
  } catch {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }

  const { webhook_type, webhook_code, item_id } = body;
  console.log(`Webhook received: ${webhook_type}/${webhook_code} for item ${item_id}`);

  // Look up the plaid item
  const [item] = await db
    .select({ id: plaidItems.id })
    .from(plaidItems)
    .where(eq(plaidItems.itemId, item_id));

  if (!item) {
    console.error(`Webhook for unknown item: ${item_id}`);
    res.json({ received: true });
    return;
  }

  // Acknowledge immediately, process async
  res.json({ received: true });

  // Handle webhook events
  try {
    switch (webhook_type) {
      case 'TRANSACTIONS':
        if (['SYNC_UPDATES_AVAILABLE', 'DEFAULT_UPDATE', 'INITIAL_UPDATE', 'HISTORICAL_UPDATE'].includes(webhook_code)) {
          await syncTransactions(item.id);
          await logActivity(null, 'webhook_transactions_synced', {
            item_id,
            webhook_code,
          });
        }
        break;

      case 'HOLDINGS':
        if (webhook_code === 'DEFAULT_UPDATE') {
          await syncInvestments(item.id);
          await logActivity(null, 'webhook_holdings_synced', {
            item_id,
            webhook_code,
          });
        }
        break;

      case 'INVESTMENTS_TRANSACTIONS':
        if (webhook_code === 'DEFAULT_UPDATE' || webhook_code === 'HISTORICAL_UPDATE') {
          await syncInvestments(item.id);
          await logActivity(null, 'webhook_investments_synced', {
            item_id,
            webhook_code,
          });
        }
        break;

      case 'ITEM':
        if (webhook_code === 'ERROR') {
          console.error(`Item error for ${item_id}:`, body.error);
          await logActivity(null, 'webhook_item_error', {
            item_id,
            error: body.error,
          });
        } else if (webhook_code === 'LOGIN_REPAIRED') {
          await syncAccounts(item.id);
          await syncTransactions(item.id);
          await logActivity(null, 'webhook_login_repaired', { item_id });
        } else if (webhook_code === 'PENDING_EXPIRATION') {
          await logActivity(null, 'webhook_pending_expiration', {
            item_id,
            consent_expiration_time: (body as Record<string, unknown>).consent_expiration_time,
          });
        } else if (webhook_code === 'NEW_ACCOUNTS_AVAILABLE') {
          await logActivity(null, 'webhook_new_accounts', { item_id });
        }
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Webhook handler error for ${webhook_type}/${webhook_code}:`, message);
  }
});
