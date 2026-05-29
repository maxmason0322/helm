import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { accounts, holdings, investmentTransactions } from '../db/schema.js';
import { getCoinbaseAccounts, getCryptoPrice, getCoinbaseFills } from './coinbase.service.js';

const COINBASE_ACCOUNT_ID = 'coinbase-portfolio';

export interface CoinbaseSyncResult {
  holdingsSynced: number;
  tradesSynced: number;
  totalValue: number;
}

export async function syncCoinbase(): Promise<CoinbaseSyncResult> {
  const cryptoAccounts = await getCoinbaseAccounts();

  if (cryptoAccounts.length === 0) {
    return { holdingsSynced: 0, tradesSynced: 0, totalValue: 0 };
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
    const available = parseFloat(crypto.available_balance.value) || 0;
    const hold = parseFloat(crypto.hold.value) || 0;
    const quantity = available + hold;
    const price = priceMap.get(crypto.currency) ?? null;
    const marketValue = price && !isNaN(quantity) ? quantity * price : null;

    if (marketValue && !isNaN(marketValue)) totalValue += marketValue;

    return {
      accountId: coinbaseAccountId,
      plaidSecurityId: `coinbase-${crypto.uuid}`,
      ticker: crypto.currency,
      name: crypto.name,
      quantity: quantity.toString(),
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

  // Sync trade history
  let tradesSynced = 0;
  try {
    const fills = await getCoinbaseFills();

    if (fills.length > 0) {
      const tradesData = fills.map(fill => {
        const ticker = fill.product_id.split('-')[0]; // "BTC-USD" → "BTC"
        const size = parseFloat(fill.size) || 0;
        const price = parseFloat(fill.price) || 0;
        const amount = size * price;

        return {
          accountId: coinbaseAccountId,
          plaidInvestmentTransactionId: `coinbase-${fill.entry_id}`,
          date: new Date(fill.trade_time),
          type: fill.side.toLowerCase(), // "BUY" → "buy", "SELL" → "sell"
          ticker,
          amount: amount.toString(),
          quantity: fill.size,
          price: fill.price,
        };
      });

      await db.transaction(async (tx) => {
        for (const trade of tradesData) {
          await tx
            .insert(investmentTransactions)
            .values(trade)
            .onConflictDoUpdate({
              target: investmentTransactions.plaidInvestmentTransactionId,
              set: {
                amount: trade.amount,
                quantity: trade.quantity,
                price: trade.price,
                type: trade.type,
                date: trade.date,
              },
            });
        }
      });

      tradesSynced = tradesData.length;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Failed to sync Coinbase trades:', message);
  }

  return { holdingsSynced: holdingsData.length, tradesSynced, totalValue };
}
