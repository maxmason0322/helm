ALTER TABLE "holdings" ADD COLUMN "plaid_security_id" text;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD COLUMN "plaid_investment_transaction_id" text;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD CONSTRAINT "investment_txns_plaid_investment_transaction_id_unique" UNIQUE("plaid_investment_transaction_id");