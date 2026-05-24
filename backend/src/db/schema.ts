import { pgTable, serial, integer, text, numeric, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

// Re-export Better Auth tables so Drizzle sees the full schema
export { user, session, account, verification, userRelations, sessionRelations, accountRelations } from './auth-schema.js';
import { user } from './auth-schema.js';

export const plaidItems = pgTable('plaid_items', {
  id: serial('id').primaryKey(),
  itemId: text('item_id').notNull().unique(),
  accessToken: text('access_token').notNull(), // Must be encrypted before storage
  institutionName: text('institution_name'),
  institutionId: text('institution_id'),
  cursor: text('cursor'), // Plaid sync cursor
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  plaidItemId: integer('plaid_item_id').references(() => plaidItems.id, { onDelete: 'set null' }),
  plaidAccountId: text('plaid_account_id').unique(),
  institution: text('institution'),
  name: text('name').notNull(),
  type: text('type').notNull(),
  subtype: text('subtype'),
  mask: text('mask'),
  currentBalance: numeric('current_balance'),
  availableBalance: numeric('available_balance'),
  currency: text('currency').default('USD'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  hiddenAt: timestamp('hidden_at'),
  deletedAt: timestamp('deleted_at'),
});

export const transactions = pgTable('transactions', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  plaidTransactionId: text('plaid_transaction_id').unique(),
  date: timestamp('date').notNull(),
  amount: numeric('amount').notNull(),
  merchant: text('merchant'),
  name: text('name'),
  category: text('category'),
  pending: boolean('pending').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const holdings = pgTable('holdings', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  plaidSecurityId: text('plaid_security_id'),
  ticker: text('ticker'),
  name: text('name'),
  quantity: numeric('quantity').notNull(),
  costBasis: numeric('cost_basis'),
  marketValue: numeric('market_value'),
  currency: text('currency').default('USD'),
  updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()).notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const investmentTransactions = pgTable('investment_txns', {
  id: serial('id').primaryKey(),
  accountId: integer('account_id').references(() => accounts.id).notNull(),
  plaidInvestmentTransactionId: text('plaid_investment_transaction_id').unique(),
  date: timestamp('date').notNull(),
  type: text('type').notNull(), // buy, sell, dividend
  ticker: text('ticker'),
  amount: numeric('amount').notNull(),
  quantity: numeric('quantity'),
  price: numeric('price'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const activityLog = pgTable('activity_log', {
  id: serial('id').primaryKey(),
  userId: text('user_id').references(() => user.id),
  action: text('action').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
