import { eq } from 'drizzle-orm';
import { plaidClient } from './plaid.service.js';
import { decrypt } from './encryption.js';
import { db } from '../db/index.js';
import { plaidItems, accounts } from '../db/schema.js';

export async function syncAccounts(plaidItemId: number) {
  const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, plaidItemId));
  if (!item) throw new Error('Plaid item not found');

  const accessToken = decrypt(item.accessToken);
  const response = await plaidClient.accountsGet({ access_token: accessToken });

  await db.transaction(async (tx) => {
    for (const plaidAccount of response.data.accounts) {
      await tx
        .insert(accounts)
        .values({
          plaidItemId: item.id,
          plaidAccountId: plaidAccount.account_id,
          institution: item.institutionName,
          name: plaidAccount.name,
          type: plaidAccount.type,
          subtype: plaidAccount.subtype ?? null,
          mask: plaidAccount.mask ?? null,
          currentBalance: plaidAccount.balances.current?.toString() ?? null,
          availableBalance: plaidAccount.balances.available?.toString() ?? null,
          currency: plaidAccount.balances.iso_currency_code ?? 'USD',
        })
        .onConflictDoUpdate({
          target: accounts.plaidAccountId,
          set: {
            institution: item.institutionName,
            name: plaidAccount.name,
            type: plaidAccount.type,
            subtype: plaidAccount.subtype ?? null,
            mask: plaidAccount.mask ?? null,
            currentBalance: plaidAccount.balances.current?.toString() ?? null,
            availableBalance: plaidAccount.balances.available?.toString() ?? null,
            currency: plaidAccount.balances.iso_currency_code ?? 'USD',
          },
        });
    }
  });
}

export async function syncAllAccounts() {
  const items = await db.select().from(plaidItems);
  for (const item of items) {
    try {
      await syncAccounts(item.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Failed to sync accounts for item ${item.id}:`, message);
    }
  }
}
