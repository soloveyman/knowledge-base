DROP TABLE "document_images" CASCADE;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "stripe_subscription_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "stripe_customer_id" text;--> statement-breakpoint
ALTER TABLE "assignments" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "documents" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "modules" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "business_id";--> statement-breakpoint
ALTER TABLE "tests" DROP COLUMN "business_id";