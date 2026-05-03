ALTER TABLE "accounts" DROP CONSTRAINT "accounts_plaid_item_id_plaid_items_id_fk";
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "holdings" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "investment_txns" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_plaid_item_id_plaid_items_id_fk" FOREIGN KEY ("plaid_item_id") REFERENCES "public"."plaid_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;