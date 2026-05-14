import { eq, and, inArray } from 'drizzle-orm';
import { plaidClient } from './plaid.service.js';
import { decrypt } from './encryption.js';
import { db } from '../db/index.js';
import { plaidItems, accounts, holdings, investmentTransactions } from '../db/schema.js';

const MAX_INVESTMENT_TXN_PAGES = 20;
const INVESTMENT_TXN_PAGE_SIZE = 500;

interface InvestmentSyncResult {
  holdingsSynced: number;
  transactionsSynced: number;
}

export async function syncInvestments(plaidItemId: number): Promise<InvestmentSyncResult> {
  const [item] = await db.select().from(plaidItems).where(eq(plaidItems.id, plaidItemId));
  if (!item) throw new Error('Plaid item not found');

  // Get investment accounts for this item
  const investmentAccounts = await db
    .select({ id: accounts.id, plaidAccountId: accounts.plaidAccountId })
    .from(accounts)
    .where(and(eq(accounts.plaidItemId, plaidItemId), eq(accounts.type, 'investment')));

  if (investmentAccounts.length === 0) return { holdingsSynced: 0, transactionsSynced: 0 };

  const accountMap = new Map<string, number>();
  for (const a of investmentAccounts) {
    if (a.plaidAccountId) accountMap.set(a.plaidAccountId, a.id);
  }

  const localAccountIds = investmentAccounts.map(a => a.id);
  let holdingsSynced = 0;
  let transactionsSynced = 0;

  // Sync holdings
  try {
    const accessToken = decrypt(item.accessToken);
    const holdingsResponse = await plaidClient.investmentsHoldingsGet({
      access_token: accessToken,
    });

    const securities = new Map(
      holdingsResponse.data.securities.map(s => [s.security_id, s]),
    );

    await db.transaction(async (tx) => {
      // Hard-delete existing holdings (snapshot data, no audit need)
      if (localAccountIds.length > 0) {
        await tx.delete(holdings).where(inArray(holdings.accountId, localAccountIds));
      }

      for (const holding of holdingsResponse.data.holdings) {
        const localAccountId = accountMap.get(holding.account_id);
        if (!localAccountId) continue;

        const security = securities.get(holding.security_id);

        await tx.insert(holdings).values({
          accountId: localAccountId,
          plaidSecurityId: holding.security_id,
          ticker: security?.ticker_symbol ?? null,
          name: security?.name ?? null,
          quantity: holding.quantity.toString(),
          costBasis: holding.cost_basis?.toString() ?? null,
          marketValue: holding.institution_value?.toString() ?? null,
          currency: holding.iso_currency_code ?? 'USD',
        });
        holdingsSynced++;
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Failed to sync holdings for item ${plaidItemId}:`, message);
  }

  // Sync investment transactions (paginated)
  try {
    const accessToken = decrypt(item.accessToken);
    const now = new Date();
    const startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
      .toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    let offset = 0;
    let totalTxns = Infinity;
    let pages = 0;

    while (offset < totalTxns && pages < MAX_INVESTMENT_TXN_PAGES) {
      const txnResponse = await plaidClient.investmentsTransactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { offset, count: INVESTMENT_TXN_PAGE_SIZE },
      });

      totalTxns = txnResponse.data.total_investment_transactions;

      const securities = new Map(
        txnResponse.data.securities.map(s => [s.security_id, s]),
      );

      await db.transaction(async (tx) => {
        for (const txn of txnResponse.data.investment_transactions) {
          const localAccountId = accountMap.get(txn.account_id);
          if (!localAccountId) continue;

          const security = txn.security_id ? securities.get(txn.security_id) : null;

          await tx
            .insert(investmentTransactions)
            .values({
              accountId: localAccountId,
              plaidInvestmentTransactionId: txn.investment_transaction_id,
              date: new Date(txn.date),
              type: txn.type,
              ticker: security?.ticker_symbol ?? null,
              amount: txn.amount.toString(),
              quantity: txn.quantity?.toString() ?? null,
              price: txn.price?.toString() ?? null,
            })
            .onConflictDoUpdate({
              target: investmentTransactions.plaidInvestmentTransactionId,
              set: {
                amount: txn.amount.toString(),
                quantity: txn.quantity?.toString() ?? null,
                price: txn.price?.toString() ?? null,
                ticker: security?.ticker_symbol ?? null,
                type: txn.type,
                date: new Date(txn.date),
              },
            });
          transactionsSynced++;
        }
      });

      offset += txnResponse.data.investment_transactions.length;
      pages++;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error(`Failed to sync investment transactions for item ${plaidItemId}:`, message);
  }

  return { holdingsSynced, transactionsSynced };
}

export interface InvestmentSyncAllResult {
  itemsSynced: number;
  itemsFailed: number;
  holdingsSynced: number;
  transactionsSynced: number;
}

export async function syncAllInvestments(): Promise<InvestmentSyncAllResult> {
  const items = await db.select().from(plaidItems);
  let itemsSynced = 0;
  let itemsFailed = 0;
  let holdingsSynced = 0;
  let transactionsSynced = 0;

  for (const item of items) {
    try {
      const result = await syncInvestments(item.id);
      holdingsSynced += result.holdingsSynced;
      transactionsSynced += result.transactionsSynced;
      itemsSynced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`Failed to sync investments for item ${item.id}:`, message);
      itemsFailed++;
    }
  }

  return { itemsSynced, itemsFailed, holdingsSynced, transactionsSynced };
}
