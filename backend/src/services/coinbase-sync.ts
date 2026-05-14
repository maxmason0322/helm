import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, holdings } from '../db/schema.js';
import { getCoinbaseAccounts, getCryptoPrice } from './coinbase.service.js';

const COINBASE_ACCOUNT_ID = 'coinbase-portfolio';

export interface CoinbaseSyncResult {
  holdingsSynced: number;
  totalValue: number;
}

export async function syncCoinbase(): Promise<CoinbaseSyncResult> {
  const cryptoAccounts = await getCoinbaseAccounts();

  if (cryptoAccounts.length === 0) {
    return { holdingsSynced: 0, totalValue: 0 };
  }

  // Ensure a Coinbase account exists in our accounts table
  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.plaidAccountId, COINBASE_ACCOUNT_ID));

  let coinbaseAccountId: number;

  if (existingAccount) {
    coinbaseAccountId = existingAccount.id;
  } else {
    const [inserted] = await db
      .insert(accounts)
      .values({
        plaidAccountId: COINBASE_ACCOUNT_ID,
        institution: 'Coinbase',
        name: 'Coinbase',
        type: 'crypto',
        subtype: 'cryptocurrency',
        currentBalance: '0',
        currency: 'USD',
      })
      .returning({ id: accounts.id });
    coinbaseAccountId = inserted.id;
  }

  // Fetch all prices in parallel (outside the DB transaction)
  const priceMap = new Map<string, number | null>();
  await Promise.all(
    cryptoAccounts.map(async (crypto) => {
      const price = await getCryptoPrice(crypto.currency);
      priceMap.set(crypto.currency, price);
    }),
  );

  // Build holdings data
  let totalValue = 0;
  const holdingsData = cryptoAccounts.map(crypto => {
    const quantity = parseFloat(crypto.available_balance.value);
    const price = priceMap.get(crypto.currency) ?? null;
    const marketValue = price && !isNaN(quantity) ? quantity * price : null;

    if (marketValue && !isNaN(marketValue)) totalValue += marketValue;

    return {
      accountId: coinbaseAccountId,
      plaidSecurityId: `coinbase-${crypto.uuid}`,
      ticker: crypto.currency,
      name: crypto.name,
      quantity: isNaN(quantity) ? '0' : crypto.available_balance.value,
      costBasis: null as string | null,
      marketValue: marketValue && !isNaN(marketValue) ? marketValue.toString() : null,
      currency: 'USD',
    };
  });

  // Write to DB in a single transaction (no network calls inside)
  await db.transaction(async (tx) => {
    await tx.delete(holdings).where(eq(holdings.accountId, coinbaseAccountId));

    for (const h of holdingsData) {
      await tx.insert(holdings).values(h);
    }

    await tx
      .update(accounts)
      .set({ currentBalance: totalValue.toString() })
      .where(eq(accounts.id, coinbaseAccountId));
  });

  return { holdingsSynced: holdingsData.length, totalValue };
}
