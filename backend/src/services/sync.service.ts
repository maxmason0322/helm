import { eq } from 'drizzle-orm';
import { plaidClient } from './plaid.service.js';
import { decrypt } from './encryption.js';
import { db } from '../db/index.js';
import { plaidItems, accounts, transactions } from '../db/schema.js';

const MAX_SYNC_PAGES = 50;

interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

export async function syncTransactions(plaidItemId: number): Promise<SyncResult> {
  const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, plaidItemId));
  if (!item) throw new Error('Plaid item not found');

  // Build a map of plaidAccountId → local account id
  const localAccounts = await db
    .select({ id: accounts.id, plaidAccountId: accounts.plaidAccountId })
    .from(accounts)
    .where(eq(accounts.plaidItemId, plaidItemId));

  const accountMap = new Map<string, number>();
  for (const a of localAccounts) {
    if (a.plaidAccountId) accountMap.set(a.plaidAccountId, a.id);
  }

  const accessToken = decrypt(item.accessToken);
  let cursor = item.cursor || '';
  let hasMore = true;
  let pages = 0;
  const totals: SyncResult = { added: 0, modified: 0, removed: 0 };

  while (hasMore && pages < MAX_SYNC_PAGES) {
    const response = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    });

    const { added, modified, removed, next_cursor, has_more } = response.data;

    await db.transaction(async (tx) => {
      for (const txn of added) {
        const localAccountId = accountMap.get(txn.account_id);
        if (!localAccountId) continue;

        await tx
          .insert(transactions)
          .values({
            accountId: localAccountId,
            plaidTransactionId: txn.transaction_id,
            date: new Date(txn.date),
            amount: txn.amount.toString(),
            merchant: txn.merchant_name ?? null,
            name: txn.name,
            category: txn.personal_finance_category?.primary ?? null,
            pending: txn.pending,
          })
          .onConflictDoUpdate({
            target: transactions.plaidTransactionId,
            set: {
              amount: txn.amount.toString(),
              merchant: txn.merchant_name ?? null,
              name: txn.name,
              category: txn.personal_finance_category?.primary ?? null,
              pending: txn.pending,
              date: new Date(txn.date),
            },
          });
      }

      for (const txn of modified) {
        const localAccountId = accountMap.get(txn.account_id);
        if (!localAccountId) continue;

        await tx
          .update(transactions)
          .set({
            amount: txn.amount.toString(),
            merchant: txn.merchant_name ?? null,
            name: txn.name,
            category: txn.personal_finance_category?.primary ?? null,
            pending: txn.pending,
            date: new Date(txn.date),
          })
          .where(eq(transactions.plaidTransactionId, txn.transaction_id));
      }

      for (const txn of removed) {
        if (!txn.transaction_id) continue;
        await tx
          .update(transactions)
          .set({ deletedAt: new Date() })
          .where(eq(transactions.plaidTransactionId, txn.transaction_id));
      }

      // Save cursor atomically with transaction data
      await tx.update(plaidItems).set({ cursor: next_cursor }).where(eq(plaidItems.id, plaidItemId));
    });

    totals.added += added.length;
    totals.modified += modified.length;
    totals.removed += removed.length;
    cursor = next_cursor;
    hasMore = has_more;
    pages++;
  }

  return totals;
}

export interface SyncAllResult {
  itemsSynced: number;
  itemsFailed: number;
  totals: SyncResult;
}

export async function syncAllTransactions(): Promise<SyncAllResult> {
  const items = await db.select().from(plaidItems);
  let itemsSynced = 0;
  let itemsFailed = 0;
  const totals: SyncResult = { added: 0, modified: 0, removed: 0 };

  for (const item of items) {
    try {
      const result = await syncTransactions(item.id);
      totals.added += result.added;
      totals.modified += result.modified;
      totals.removed += result.removed;
      itemsSynced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Failed to sync transactions for item ${item.id}:`, message);
      itemsFailed++;
    }
  }

  return { itemsSynced, itemsFailed, totals };
}
